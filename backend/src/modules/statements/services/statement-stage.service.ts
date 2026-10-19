import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { ensureCanEdit } from '../../../common/utils/ensure-can-edit.util';
import { decideStageMove } from '../../../common/workflow/review-stage.rules';
import { User, WorkspaceMember, WorkspaceRole } from '../../../entities';
import { ActorType, AuditAction, EntityType, Severity } from '../../../entities/audit-event.entity';
import { Statement, type StatementStage } from '../../../entities/statement.entity';
import { Transaction } from '../../../entities/transaction.entity';
import { AuditService } from '../../audit/audit.service';
import type {
  StatementStageSkipDto,
  UpdateStatementStageResultDto,
} from '../dto/update-statement-stage.dto';

@Injectable()
export class StatementStageService {
  constructor(
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Moves statements of one workspace to `target`. Each statement is decided on
   * its own: the ones that may not move are reported in `skipped` with a code
   * and the rest still move, so one uncategorised statement does not block a
   * bulk submit.
   */
  async updateStage(
    statementIds: string[],
    target: StatementStage,
    userId: string,
    workspaceId: string,
  ): Promise<UpdateStatementStageResultDto> {
    await ensureCanEdit(
      this.workspaceMemberRepository,
      workspaceId,
      userId,
      'canEditStatements',
      'STATEMENTS_EDIT_FORBIDDEN',
    );

    const ids = [...new Set(statementIds)];
    const statements = await this.statementRepository.find({
      where: { id: In(ids), workspaceId },
      select: ['id', 'userId', 'stage', 'deletedAt'],
    });
    const byId = new Map(
      statements
        .filter(statement => !statement.deletedAt)
        .map(statement => [statement.id, statement]),
    );
    const canEditOthers = await this.isWorkspaceAdmin(userId, workspaceId);
    const uncategorized = await this.countUncategorized([...byId.keys()], workspaceId);

    const skipped: StatementStageSkipDto[] = [];
    const unchanged: string[] = [];
    const toMove: Statement[] = [];

    for (const id of ids) {
      const statement = byId.get(id);
      if (!statement) {
        skipped.push({ id, code: 'STATEMENT_NOT_FOUND' });
        continue;
      }
      // Same rule as editing a single statement: the uploader, or a workspace admin/owner.
      if (statement.userId !== userId && !canEditOthers) {
        skipped.push({ id, code: 'STATEMENT_EDIT_FORBIDDEN' });
        continue;
      }
      const decision = decideStageMove(
        statement.stage,
        target,
        (uncategorized.get(id) ?? 0) > 0 ? 'UNCATEGORIZED_TRANSACTIONS' : null,
      );
      if ('code' in decision) {
        skipped.push({ id, code: decision.code });
      } else if (decision.changed) {
        toMove.push(statement);
      } else {
        unchanged.push(id);
      }
    }

    const moved = await this.applyMoves(toMove, target, workspaceId);
    for (const statement of toMove) {
      if (!moved.has(statement.id)) {
        // Its stage changed between the read and the write; the caller can reload and retry.
        skipped.push({ id: statement.id, code: 'INVALID_STAGE_TRANSITION' });
      }
    }

    await this.recordAudit(
      toMove.filter(statement => moved.has(statement.id)),
      target,
      userId,
      workspaceId,
    );

    return {
      updated: [...unchanged, ...toMove.filter(s => moved.has(s.id)).map(s => s.id)],
      skipped,
    };
  }

  private async isWorkspaceAdmin(userId: string, workspaceId: string): Promise<boolean> {
    const membership = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId },
      select: ['role'],
    });
    return Boolean(
      membership && [WorkspaceRole.ADMIN, WorkspaceRole.OWNER].includes(membership.role),
    );
  }

  /** Per statement: transactions with no category or a disabled one. */
  private async countUncategorized(
    statementIds: string[],
    workspaceId: string,
  ): Promise<Map<string, number>> {
    if (statementIds.length === 0) {
      return new Map();
    }
    const rows = await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.category', 'category')
      .select('transaction.statementId', 'statementId')
      .addSelect('COUNT(*)', 'count')
      .where('transaction.workspaceId = :workspaceId', { workspaceId })
      .andWhere('transaction.statementId IN (:...statementIds)', { statementIds })
      .andWhere('(transaction.categoryId IS NULL OR category.isEnabled = false)')
      .groupBy('transaction.statementId')
      .getRawMany<{ statementId: string; count: string }>();
    return new Map(rows.map(row => [row.statementId, Number(row.count)]));
  }

  /**
   * One UPDATE per source stage, guarded by that stage: a statement another
   * request moved in the meantime is left alone instead of being overwritten.
   */
  private async applyMoves(
    statements: Statement[],
    target: StatementStage,
    workspaceId: string,
  ): Promise<Set<string>> {
    const moved = new Set<string>();
    const bySource = new Map<StatementStage, string[]>();
    for (const statement of statements) {
      bySource.set(statement.stage, [...(bySource.get(statement.stage) ?? []), statement.id]);
    }
    for (const [source, ids] of bySource) {
      const result = await this.statementRepository
        .createQueryBuilder()
        .update(Statement)
        .set({ stage: target })
        .where('id IN (:...ids)', { ids })
        .andWhere('workspace_id = :workspaceId', { workspaceId })
        .andWhere('stage = :source', { source })
        .returning(['id'])
        .execute();
      for (const row of (result.raw ?? []) as Array<{ id: string }>) {
        moved.add(row.id);
      }
    }
    return moved;
  }

  private async recordAudit(
    statements: Statement[],
    target: StatementStage,
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    if (statements.length === 0) {
      return;
    }
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'name', 'email'],
    });
    const actorLabel = user?.email || user?.name || 'User';
    await this.auditService.createBatchEvents(
      statements.map(statement => ({
        workspaceId,
        actorType: ActorType.USER,
        actorId: userId,
        actorLabel,
        entityType: EntityType.STATEMENT,
        entityId: statement.id,
        action: AuditAction.UPDATE,
        diff: { before: { stage: statement.stage }, after: { stage: target } },
        meta: { reason: 'stage-change' },
        severity: Severity.INFO,
        isUndoable: false,
      })),
      randomUUID(),
    );
  }
}
