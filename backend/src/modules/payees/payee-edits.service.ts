import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type { DataSource, Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { ActorType, AuditAction, EntityType } from '../../entities/audit-event.entity';
import { Payee, PayeeMode } from '../../entities/payee.entity';
import { TransactionCategorySource } from '../../entities/transaction.entity';
import { AuditService } from '../audit/audit.service';
import { TaxAssignmentService } from '../tax/tax-assignment.service';
import { resolvePayeeId } from './payee-resolution';
import { UNDECIDED_CATEGORY_SOURCES } from './payee-undecided';

/** node-postgres hands back [rows, count] for an UPDATE or DELETE … RETURNING through TypeORM. */
const returnedRows = <T>(result: unknown[]): T[] =>
  (Array.isArray(result[0]) ? result[0] : result) as T[];

/** Clean-up from the payee card: a pinned category over past rows, a name that is someone else. */
@Injectable()
export class PayeeEditsService {
  constructor(
    @InjectRepository(Payee)
    private readonly payeeRepository: Repository<Payee>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly taxAssignmentService: TaxAssignmentService,
  ) {}

  /**
   * Files the payee's past rows under its pinned category, where nobody chose
   * one: a manual pick, a rule and a row on a filed tax return stay as they are.
   */
  async applyCategory(
    workspaceId: string,
    userId: string,
    payeeId: string,
  ): Promise<{ updated: number }> {
    const payee = await this.findPayee(workspaceId, payeeId);
    if (!(payee.mode === PayeeMode.ALWAYS && payee.categoryId)) {
      throw new BadRequestException(appError('PAYEE_CATEGORY_NOT_PINNED'));
    }
    const updated: unknown[] = await this.dataSource.query(
      `UPDATE transactions
          SET category_id = $3, category_source = $4, category_reason = $5
        WHERE workspace_id = $1 AND payee_id = $2
          AND is_duplicate = false AND tax_locked = false
          AND category_id IS DISTINCT FROM $3
          AND (category_id IS NULL OR category_source = ANY($6))
        RETURNING id`,
      [
        workspaceId,
        payee.id,
        payee.categoryId,
        TransactionCategorySource.LEARNED,
        payee.name,
        UNDECIDED_CATEGORY_SOURCES,
      ],
    );
    const ids = returnedRows<{ id: string }>(updated).map(row => row.id);
    if (ids.length > 0) {
      // A raw update: the tax subscriber did not see the new category.
      await this.taxAssignmentService.reassess(workspaceId, { ids });
      await this.auditService.createEvent({
        workspaceId,
        actorType: ActorType.USER,
        actorId: userId,
        entityType: EntityType.PAYEE,
        entityId: payee.id,
        action: AuditAction.UPDATE,
        meta: { appliedCategoryId: payee.categoryId, transactions: ids.length },
      });
    }
    return { updated: ids.length };
  }

  /**
   * "This name is somebody else": the descriptor stops meaning this payee, and
   * its rows move to a payee of their own (found or created from the name, as
   * an import would), which the next import of it follows too.
   */
  async splitAlias(
    workspaceId: string,
    userId: string,
    payeeId: string,
    payeeKey: string,
  ): Promise<{ updated: number }> {
    await this.findPayee(workspaceId, payeeId);
    const moved = await this.dataSource.transaction(async manager => {
      const deleted: unknown[] = await manager.query(
        'DELETE FROM payee_aliases WHERE workspace_id = $1 AND payee_id = $2 AND payee_key = $3 RETURNING payee_key',
        [workspaceId, payeeId, payeeKey],
      );
      if (returnedRows(deleted).length === 0) {
        throw new NotFoundException(appError('PAYEE_ALIAS_NOT_FOUND'));
      }
      const [sample] = await manager.query(
        `SELECT counterparty_name AS "counterpartyName", payment_purpose AS "paymentPurpose"
           FROM transactions WHERE workspace_id = $1 AND payee_key = $2
          ORDER BY transaction_date DESC LIMIT 1`,
        [workspaceId, payeeKey],
      );
      const newPayeeId = sample ? await resolvePayeeId(manager, workspaceId, sample) : null;
      if (!newPayeeId) {
        return { newPayeeId: null, ids: [] as string[] };
      }
      const updated: unknown[] = await manager.query(
        `UPDATE transactions SET payee_id = $1
          WHERE workspace_id = $2 AND payee_id = $3 AND payee_key = $4 RETURNING id`,
        [newPayeeId, workspaceId, payeeId, payeeKey],
      );
      return { newPayeeId, ids: returnedRows<{ id: string }>(updated).map(row => row.id) };
    });

    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.PAYEE,
      entityId: payeeId,
      action: AuditAction.UPDATE,
      meta: { splitAlias: payeeKey, movedTo: moved.newPayeeId, transactions: moved.ids.length },
    });
    return { updated: moved.ids.length };
  }

  private async findPayee(workspaceId: string, id: string): Promise<Payee> {
    const payee = await this.payeeRepository.findOne({ where: { id, workspaceId } });
    if (!payee) {
      throw new NotFoundException(appError('PAYEE_NOT_FOUND'));
    }
    return payee;
  }
}
