import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, In, type Repository } from 'typeorm';
import { ensureCanEdit } from '../../../common/utils/ensure-can-edit.util';
import { decideStageMove } from '../../../common/workflow/review-stage.rules';
import { Receipt, User, WorkspaceMember, WorkspaceRole } from '../../../entities';
import { ActorType, AuditAction, EntityType, Severity } from '../../../entities/audit-event.entity';
import { Statement, StatementStage } from '../../../entities/statement.entity';
import { AuditService } from '../../audit/audit.service';
import type {
  ReceiptStageSkipDto,
  UpdateReceiptStageResultDto,
} from '../dto/update-receipt-stage.dto';

type StagedReceipt = Pick<Receipt, 'id' | 'userId' | 'stage' | 'statementId' | 'parsedData'>;

@Injectable()
export class ReceiptStageService {
  constructor(
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Moves receipts of one workspace between Submit and Approve, each decided on
   * its own like statements are. A scanned receipt's statement (the one the scan
   * created) moves with it in the same database transaction, so the stage
   * counts, which are taken from statements, agree with the list.
   */
  async updateStage(
    receiptIds: string[],
    target: StatementStage,
    userId: string,
    workspaceId: string,
  ): Promise<UpdateReceiptStageResultDto> {
    await ensureCanEdit(
      this.workspaceMemberRepository,
      workspaceId,
      userId,
      'canEditStatements',
      'STATEMENTS_EDIT_FORBIDDEN',
    );

    const ids = [...new Set(receiptIds)];
    const receipts: StagedReceipt[] = await this.receiptRepository.find({
      where: { id: In(ids), workspaceId },
      select: ['id', 'userId', 'stage', 'statementId', 'parsedData'],
    });
    const byId = new Map(receipts.map(receipt => [receipt.id, receipt]));
    const canEditOthers = await this.isWorkspaceAdmin(userId, workspaceId);

    const skipped: ReceiptStageSkipDto[] = [];
    const unchanged: string[] = [];
    const toMove: StagedReceipt[] = [];

    for (const id of ids) {
      const receipt = byId.get(id);
      if (!receipt) {
        skipped.push({ id, code: 'RECEIPT_NOT_FOUND' });
        continue;
      }
      if (receipt.userId !== userId && !canEditOthers) {
        skipped.push({ id, code: 'RECEIPT_EDIT_FORBIDDEN' });
        continue;
      }
      // Pay turns a statement into a payable; receipts have no such step yet.
      if (target === StatementStage.PAY) {
        skipped.push({ id, code: 'INVALID_STAGE_TRANSITION' });
        continue;
      }
      const hasData = Boolean(receipt.parsedData?.amount && receipt.parsedData?.date);
      const decision = decideStageMove(
        receipt.stage,
        target,
        hasData ? null : 'MISSING_RECEIPT_DATA',
      );
      if ('code' in decision) {
        skipped.push({ id, code: decision.code });
      } else if (decision.changed) {
        toMove.push(receipt);
      } else {
        unchanged.push(id);
      }
    }

    const moved = await this.receiptRepository.manager.transaction(manager =>
      this.applyMoves(manager, toMove, target, workspaceId),
    );
    for (const receipt of toMove) {
      if (!moved.has(receipt.id)) {
        // Its stage changed between the read and the write; the caller can reload and retry.
        skipped.push({ id: receipt.id, code: 'INVALID_STAGE_TRANSITION' });
      }
    }

    const movedReceipts = toMove.filter(receipt => moved.has(receipt.id));
    await this.recordAudit(movedReceipts, target, userId, workspaceId);

    return { updated: [...unchanged, ...movedReceipts.map(receipt => receipt.id)], skipped };
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

  /**
   * One UPDATE per source stage, guarded by that stage, then the scans'
   * statements of the receipts that actually moved.
   */
  private async applyMoves(
    manager: EntityManager,
    receipts: StagedReceipt[],
    target: StatementStage,
    workspaceId: string,
  ): Promise<Set<string>> {
    const moved = new Set<string>();
    const bySource = new Map<StatementStage, string[]>();
    for (const receipt of receipts) {
      bySource.set(receipt.stage, [...(bySource.get(receipt.stage) ?? []), receipt.id]);
    }
    for (const [source, ids] of bySource) {
      const result = await manager
        .createQueryBuilder()
        .update(Receipt)
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

    const statementIds = receipts
      .filter(receipt => moved.has(receipt.id) && receipt.statementId)
      .map(receipt => receipt.statementId as string);
    if (statementIds.length > 0) {
      await manager
        .createQueryBuilder()
        .update(Statement)
        .set({ stage: target })
        .where('id IN (:...statementIds)', { statementIds })
        .andWhere('workspace_id = :workspaceId', { workspaceId })
        .execute();
    }
    return moved;
  }

  private async recordAudit(
    receipts: StagedReceipt[],
    target: StatementStage,
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    if (receipts.length === 0) {
      return;
    }
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'name', 'email'],
    });
    const actorLabel = user?.email || user?.name || 'User';
    await this.auditService.createBatchEvents(
      receipts.map(receipt => ({
        workspaceId,
        actorType: ActorType.USER,
        actorId: userId,
        actorLabel,
        entityType: EntityType.RECEIPT,
        entityId: receipt.id,
        action: AuditAction.UPDATE,
        diff: { before: { stage: receipt.stage }, after: { stage: target } },
        meta: { reason: 'stage-change', statementId: receipt.statementId ?? null },
        severity: Severity.INFO,
        isUndoable: false,
      })),
      randomUUID(),
    );
  }
}
