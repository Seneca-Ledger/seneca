import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { appError } from '../../../common/errors/app-error';
import { canReadPrivate } from '../../../common/utils/transaction-privacy.util';
import type {
  TransactionHistory,
  TransactionHistoryField,
  UpdateTransactionBody,
} from '../../../contracts';
import {
  ActorType,
  AuditAction,
  type AuditEvent,
  EntityType,
} from '../../../entities/audit-event.entity';
import { Category } from '../../../entities/category.entity';
import { Payee } from '../../../entities/payee.entity';
import { Statement } from '../../../entities/statement.entity';
import type { Transaction } from '../../../entities/transaction.entity';
import { Wallet } from '../../../entities/wallet.entity';
import { WorkspaceMember } from '../../../entities/workspace-member.entity';
import { AuditService } from '../../audit/audit.service';
import { PayeesService } from '../../payees/payees.service';
import { TransactionsService } from '../transactions.service';
import {
  asSnapshot,
  changesOf,
  FIELDS,
  normalize,
  type RawChange,
} from './transaction-history-changes';

type Entry = TransactionHistory['entries'][number];

/**
 * A transaction's history in words: which fields changed, from what to what,
 * by whom, read from the audit log of that row. "Put back" restores the fields
 * of one change, through the ordinary update, so it is audited like any edit.
 */
@Injectable()
export class TransactionHistoryService {
  constructor(
    private readonly auditService: AuditService,
    private readonly transactionsService: TransactionsService,
    private readonly payeesService: PayeesService,
    @InjectRepository(Category) private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Payee) private readonly payeeRepository: Repository<Payee>,
    @InjectRepository(Wallet) private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(WorkspaceMember)
    private readonly memberRepository: Repository<WorkspaceMember>,
    @InjectRepository(Statement) private readonly statementRepository: Repository<Statement>,
  ) {}

  async history(
    workspaceId: string,
    userId: string,
    transactionId: string,
    viewerMemberId: string | null,
  ): Promise<TransactionHistory> {
    const transaction = await this.transactionsService.findOne(transactionId, workspaceId);
    const statement = transaction.statementId
      ? await this.statementRepository.findOne({
          where: { id: transaction.statementId, workspaceId },
          select: { id: true, fileName: true },
        })
      : null;
    // Someone else's private row: what it was, and so how it changed, is theirs.
    const events = canReadPrivate(transaction, viewerMemberId)
      ? await this.auditService.findEventsByEntity(
          EntityType.TRANSACTION,
          transactionId,
          workspaceId,
        )
      : [];

    const raw = events
      .map(event => ({ event, kind: this.kindOf(event), changes: changesOf(event) }))
      .filter(item => item.kind !== null && (item.kind !== 'changed' || item.changes.length > 0));
    const undoable = this.undoable(raw, transaction);
    const names = await this.namesFor(
      workspaceId,
      raw.flatMap(item => item.changes),
      raw.map(item => item.event),
    );

    const entries: Entry[] = raw.map(({ event, kind, changes }) => ({
      id: event.id,
      at: event.createdAt.toISOString(),
      kind: kind as Entry['kind'],
      actor: this.actorOf(event, userId, names.users),
      changes: changes.map(change => ({
        field: change.field,
        before: names.show(change.field, change.before),
        after: names.show(change.field, change.after),
      })),
      parts: typeof event.meta?.partCount === 'number' ? event.meta.partCount : null,
      canUndo: undoable.has(event.id),
    }));

    return {
      origin: {
        at: transaction.createdAt.toISOString(),
        statementName: statement?.fileName ?? null,
      },
      currency: transaction.currency ?? '',
      entries,
    };
  }

  /** Puts back the fields one change wrote, if none of them has changed since. */
  async undo(
    workspaceId: string,
    userId: string,
    transactionId: string,
    eventId: string,
    viewerMemberId: string | null,
  ): Promise<TransactionHistory> {
    const transaction = await this.transactionsService.findOne(transactionId, workspaceId);
    const events = canReadPrivate(transaction, viewerMemberId)
      ? await this.auditService.findEventsByEntity(
          EntityType.TRANSACTION,
          transactionId,
          workspaceId,
        )
      : [];
    const raw = events.map(event => ({
      event,
      kind: this.kindOf(event),
      changes: changesOf(event),
    }));
    const target = raw.find(item => item.event.id === eventId);
    if (!(target && this.undoable(raw, transaction).has(eventId))) {
      throw new ConflictException(appError('TRANSACTION_CHANGE_NOT_UNDOABLE'));
    }
    const { changes } = target;

    const before = asSnapshot(asSnapshot(target.event.diff)?.before) ?? {};
    const payee = changes.find(change => change.field === 'payee');
    if (payee) {
      await this.payeesService.setTransactionPayee(workspaceId, userId, transactionId, {
        payeeId: before.payeeId as string,
      });
    }
    const body: Record<string, unknown> = {};
    for (const change of changes) {
      const spec = FIELDS.find(item => item.field === change.field);
      if (spec?.undo) {
        body[spec.undo] =
          change.field === 'date' ? change.before : ((before[spec.key] as unknown) ?? null);
      }
    }
    if (Object.keys(body).length > 0) {
      await this.transactionsService.update(
        transactionId,
        workspaceId,
        userId,
        body as UpdateTransactionBody,
        null,
        viewerMemberId,
      );
    }
    return this.history(workspaceId, userId, transactionId, viewerMemberId);
  }

  private kindOf(event: AuditEvent): Entry['kind'] | null {
    const path = typeof event.meta?.path === 'string' ? event.meta.path : '';
    switch (event.action) {
      case AuditAction.CREATE:
        return path.includes('/attachments') ? 'attachment' : 'created';
      case AuditAction.APPLY_RULE:
        return 'rule';
      case AuditAction.UPDATE:
        if (event.meta?.operation === 'split') return 'split';
        if (event.meta?.operation === 'unsplit') return 'unsplit';
        return 'changed';
      case AuditAction.ROLLBACK:
        return 'changed';
      default:
        return null;
    }
  }

  private actorOf(event: AuditEvent, userId: string, users: Map<string, string>): Entry['actor'] {
    if (event.action === AuditAction.APPLY_RULE) {
      const rule = event.meta?.ruleName;
      return { kind: 'rule', name: typeof rule === 'string' ? rule : null };
    }
    if (event.actorType !== ActorType.USER || !event.actorId) {
      return { kind: 'system', name: null };
    }
    if (event.actorId === userId) {
      return { kind: 'you', name: null };
    }
    return { kind: 'member', name: users.get(event.actorId) ?? event.actorLabel ?? null };
  }

  /**
   * The changes that can be put back: for each field only its latest change,
   * and only while the row still holds what that change wrote. Undoing it is a
   * change of its own, so the one before becomes reachable again through it.
   */
  private undoable(
    items: Array<{ event: AuditEvent; kind: Entry['kind'] | null; changes: RawChange[] }>,
    transaction: Transaction,
  ): Set<string> {
    const ids = new Set<string>();
    const touched = new Set<TransactionHistoryField>();
    // Newest first, as the audit log hands them over.
    for (const { event, kind, changes } of items) {
      if (kind !== 'changed' || changes.length === 0) {
        continue;
      }
      const latest = changes.every(change => !touched.has(change.field));
      if (latest && this.canUndo(changes, transaction)) {
        ids.add(event.id);
      }
      for (const change of changes) {
        touched.add(change.field);
      }
    }
    return ids;
  }

  /** Every field has a way back and still holds what the change wrote. */
  private canUndo(changes: RawChange[], transaction: Transaction): boolean {
    return changes.every(change => {
      const spec = FIELDS.find(item => item.field === change.field);
      const back = spec?.undo !== undefined || (change.field === 'payee' && change.before !== null);
      return (
        back &&
        spec !== undefined &&
        normalize(change.field, transaction[spec.key]) === change.after
      );
    });
  }

  /** Names for the ids the changes hold, and for the members who made them; all in this workspace. */
  private async namesFor(workspaceId: string, changes: RawChange[], events: AuditEvent[]) {
    const ids = (field: TransactionHistoryField) => [
      ...new Set(
        changes
          .filter(change => change.field === field)
          .flatMap(change => [change.before, change.after])
          .filter((id): id is string => id !== null),
      ),
    ];
    const categoryIds = ids('category');
    const payeeIds = ids('payee');
    const walletIds = ids('account');
    const memberIds = ids('owner');
    const actorIds = [
      ...new Set(events.map(event => event.actorId).filter((id): id is string => Boolean(id))),
    ];

    const [categories, payees, wallets, members, actors] = await Promise.all([
      categoryIds.length
        ? this.categoryRepository.find({ where: { id: In(categoryIds), workspaceId } })
        : [],
      payeeIds.length
        ? this.payeeRepository.find({ where: { id: In(payeeIds), workspaceId } })
        : [],
      walletIds.length
        ? this.walletRepository.find({ where: { id: In(walletIds), workspaceId } })
        : [],
      memberIds.length
        ? this.memberRepository.find({
            where: { id: In(memberIds), workspaceId },
            relations: { user: true },
          })
        : [],
      actorIds.length
        ? this.memberRepository.find({
            where: { userId: In(actorIds), workspaceId },
            relations: { user: true },
          })
        : [],
    ]);

    const byId = new Map<string, string>([
      ...categories.map(row => [row.id, row.name] as const),
      ...payees.map(row => [row.id, row.name] as const),
      ...wallets.map(row => [row.id, row.name] as const),
      ...members.map(row => [row.id, row.user?.name || row.user?.email || ''] as const),
    ]);
    const refFields = new Set<TransactionHistoryField>(['category', 'payee', 'account', 'owner']);
    return {
      users: new Map(actors.map(row => [row.userId, row.user?.name || row.user?.email || ''])),
      // A name that is gone (a deleted category) reads as nothing rather than an id.
      show: (field: TransactionHistoryField, value: string | null) =>
        value !== null && refFields.has(field) ? (byId.get(value) ?? null) : value,
    };
  }
}
