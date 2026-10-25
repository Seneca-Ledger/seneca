import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, type Repository, type SelectQueryBuilder } from 'typeorm';
import {
  applyOwnerFilter,
  type OwnerFilter,
  parseReviewerFilter,
} from '../../common/utils/transaction-owner.util';
import { canReadPrivate, redactPrivateRows } from '../../common/utils/transaction-privacy.util';
import type {
  ReviewInboxByStatement,
  ReviewInboxCounts,
  ReviewInboxDocument,
  ReviewInboxItem,
  ReviewInboxPage,
  ReviewInboxQuery,
} from '../../contracts';
import { Receipt, ReceiptStatus } from '../../entities/receipt.entity';
import { Statement } from '../../entities/statement.entity';
import { Subscription, SubscriptionStatus } from '../../entities/subscription.entity';
import { Transaction } from '../../entities/transaction.entity';
import { isUncategorizedName } from '../categories/uncategorized-category';
import type { ReceiptApprovedEvent } from '../notifications/events/notification-events';
import { CrossStatementDeduplicationService } from '../transactions/services/cross-statement-deduplication.service';
import { TransactionsService } from '../transactions/transactions.service';
import { DuplicateDecision, ReviewInboxKind } from './dto/review-inbox.dto';

import {
  pendingReceiptsQuery,
  QUEUE_DATE_COLUMN,
  reviewDuplicatesQuery,
  uncategorizedRowsQuery,
  unconfirmedRowsQuery,
} from './review-queue.queries';

/** No reviewer asked for: the whole workspace's backlog. */
const ALL_OWNERS: OwnerFilter = { kind: 'all' };

export type { ReviewInboxCounts, ReviewInboxItem, ReviewInboxPage };

const DEFAULT_LIMIT = 50;

type DateRange = Pick<ReviewInboxQuery, 'from' | 'to'>;

/**
 * One queue of everything that needs a human decision, read from the rows
 * that already exist: nothing is copied into a separate table, so an item
 * leaves the queue the moment the underlying row is resolved — by this
 * module, by the statements pages, or by an import that fixes it.
 */
@Injectable()
export class ReviewInboxService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    private readonly transactionsService: TransactionsService,
    private readonly deduplicationService: CrossStatementDeduplicationService,
    @Optional() private readonly eventEmitter?: EventEmitter2,
  ) {}

  /**
   * Every row nobody confirmed yet. Only confirmed rows count anywhere in the
   * numbers, so a row a rule, the history or the model categorised still waits
   * here; transfers too. Suspected duplicates have their own list. With
   * `uncategorized`, the rows with no category instead, confirmed or not.
   */
  private transactionsQuery(
    workspaceId: string,
    reviewer: OwnerFilter = ALL_OWNERS,
    uncategorized = false,
  ) {
    const rows = uncategorized ? uncategorizedRowsQuery : unconfirmedRowsQuery;
    const query = rows(this.transactionRepository, workspaceId)
      .addSelect(['s.id', 's.fileName', 's.fileType'])
      .leftJoinAndSelect('t.category', 'category')
      .leftJoinAndSelect('t.payee', 'payee');
    return applyOwnerFilter(query, 't', reviewer);
  }

  private duplicatesQuery(workspaceId: string, reviewer: OwnerFilter = ALL_OWNERS) {
    const query = reviewDuplicatesQuery(this.transactionRepository, workspaceId).addSelect([
      's.id',
      's.fileName',
      's.fileType',
    ]);
    return applyOwnerFilter(query, 't', reviewer);
  }

  /** Limits a queue to `from`..`to` (inclusive days) on the column it is dated by. */
  private applyDateRange<T extends { andWhere: (sql: string, params?: object) => T }>(
    query: T,
    filters: DateRange,
    column: string = QUEUE_DATE_COLUMN.row,
  ): T {
    let result = query;
    if (filters.from) {
      result = result.andWhere(`${column} >= :from`, { from: localDay(filters.from) });
    }
    if (filters.to) {
      result = result.andWhere(`${column} <= :to`, { to: localDay(filters.to, true) });
    }
    return result;
  }

  private pendingReceiptsQuery(workspaceId: string): SelectQueryBuilder<Receipt> {
    return pendingReceiptsQuery(this.receiptRepository, workspaceId);
  }

  /**
   * How many rows of each statement still wait here (undecided rows and
   * suspected duplicates), so the documents list can say what is left.
   */
  async pendingByStatement(workspaceId: string): Promise<ReviewInboxByStatement> {
    const groups = await Promise.all(
      [this.transactionsQuery(workspaceId), this.duplicatesQuery(workspaceId)].map(query =>
        query
          .andWhere('t.statementId IS NOT NULL')
          .select('t.statementId', 'statementId')
          .addSelect('COUNT(*)::int', 'count')
          .groupBy('t.statementId')
          .getRawMany<{ statementId: string; count: number }>(),
      ),
    );
    const pending: Record<string, number> = {};
    for (const { statementId, count } of groups.flat()) {
      pending[statementId] = (pending[statementId] ?? 0) + count;
    }
    return pending;
  }

  /**
   * What is still waiting. The reviewer filter has to reach the counts too, or
   * the badge would promise work that the queue then refuses to show — the way
   * Monarch's "review some transactions" banner does when the rows are someone
   * else's.
   */
  async counts(
    workspaceId: string,
    reviewer: OwnerFilter = ALL_OWNERS,
    range: DateRange = {},
  ): Promise<ReviewInboxCounts> {
    const [transaction, duplicate, receipt, subscription] = await Promise.all([
      this.applyDateRange(this.transactionsQuery(workspaceId, reviewer), range).getCount(),
      this.applyDateRange(this.duplicatesQuery(workspaceId, reviewer), range).getCount(),
      this.applyDateRange(
        this.pendingReceiptsQuery(workspaceId),
        range,
        QUEUE_DATE_COLUMN.receipt,
      ).getCount(),
      this.subscriptionRepository.count({
        where: { workspaceId, status: SubscriptionStatus.DETECTED },
      }),
    ]);
    return {
      transaction,
      receipt,
      duplicate,
      subscription,
      total: transaction + receipt + duplicate + subscription,
    };
  }

  /** Receipts attached to these rows, or that produced their statement (a scan). */
  private async receiptIdsFor(
    workspaceId: string,
    rows: Transaction[],
  ): Promise<{ byTransaction: Map<string, string>; byStatement: Map<string, string> }> {
    const byTransaction = new Map<string, string>();
    const byStatement = new Map<string, string>();
    if (rows.length === 0) return { byTransaction, byStatement };
    const statementIds = [
      ...new Set(rows.map(row => row.statementId).filter((id): id is string => Boolean(id))),
    ];
    const receipts = await this.receiptRepository.find({
      select: { id: true, transactionId: true, statementId: true },
      where: [
        { workspaceId, transactionId: In(rows.map(row => row.id)) },
        ...(statementIds.length > 0 ? [{ workspaceId, statementId: In(statementIds) }] : []),
      ],
    });
    for (const receipt of receipts) {
      if (receipt.transactionId) byTransaction.set(receipt.transactionId, receipt.id);
      if (receipt.statementId) byStatement.set(receipt.statementId, receipt.id);
    }
    return { byTransaction, byStatement };
  }

  async list(
    workspaceId: string,
    filters: ReviewInboxQuery,
    selfMemberId: string | null = null,
  ): Promise<ReviewInboxPage> {
    const kind = filters.kind ?? ReviewInboxKind.TRANSACTION;
    const page = filters.page ?? 1;
    const limit = filters.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const reviewer = parseReviewerFilter(filters.reviewer, selfMemberId);
    const counts = await this.counts(workspaceId, reviewer, filters);

    let items: ReviewInboxItem[] = [];
    let total = 0;

    if (kind === ReviewInboxKind.TRANSACTION) {
      const [rows, count] = await this.applyDateRange(
        this.transactionsQuery(workspaceId, reviewer, filters.uncategorized),
        filters,
      )
        .orderBy('t.transactionDate', 'DESC')
        .addOrderBy('t.id', 'ASC')
        .skip(skip)
        .take(limit)
        .getManyAndCount();
      total = count;
      const receiptIds = await this.receiptIdsFor(workspaceId, rows);
      items = redactPrivateRows(rows, selfMemberId).map(row => {
        const receiptId =
          receiptIds.byTransaction.get(row.id) ??
          (row.statementId ? receiptIds.byStatement.get(row.statementId) : undefined) ??
          null;
        return {
          kind: 'transaction',
          id: row.id,
          date: toDateString(row.transactionDate),
          counterpartyName: row.counterpartyName,
          paymentPurpose: row.paymentPurpose,
          payee: row.payee ? { id: row.payee.id, name: row.payee.name } : null,
          amount: absAmount(row),
          currency: row.currency,
          transactionType: row.transactionType,
          categoryId: row.categoryId,
          categoryName: row.category?.name ?? null,
          categorySource: row.categorySource,
          categoryReason: row.categoryReason,
          statementId: row.statementId,
          receiptId,
          document: documentOf(row, receiptId, selfMemberId),
        };
      });
    } else if (kind === ReviewInboxKind.DUPLICATE) {
      const [rows, count] = await this.applyDateRange(
        this.duplicatesQuery(workspaceId, reviewer),
        filters,
      )
        .orderBy('t.transactionDate', 'DESC')
        .addOrderBy('t.id', 'ASC')
        .skip(skip)
        .take(limit)
        .getManyAndCount();
      total = count;
      items = redactPrivateRows(rows, selfMemberId).map(row => ({
        kind: 'duplicate',
        id: row.id,
        date: toDateString(row.transactionDate),
        counterpartyName: row.counterpartyName,
        amount: absAmount(row),
        currency: row.currency,
        duplicateOfId: row.duplicateOfId,
        confidence: row.duplicateConfidence === null ? null : Number(row.duplicateConfidence),
        matchType: row.duplicateMatchType,
        document: documentOf(row, null, selfMemberId),
      }));
    } else if (kind === ReviewInboxKind.RECEIPT) {
      const query = this.applyDateRange(
        this.pendingReceiptsQuery(workspaceId),
        filters,
        QUEUE_DATE_COLUMN.receipt,
      );
      const [rows, count] = await query
        .orderBy('receipt.createdAt', 'DESC')
        .skip(skip)
        .take(limit)
        .getManyAndCount();
      total = count;
      items = rows.map(row => ({
        kind: 'receipt',
        id: row.id,
        date: row.parsedData?.date ?? null,
        vendor: row.parsedData?.vendor ?? null,
        amount: typeof row.parsedData?.amount === 'number' ? row.parsedData.amount : null,
        currency: row.parsedData?.currency ?? null,
        issues: receiptIssues(row),
      }));
    } else {
      const [rows, count] = await this.subscriptionRepository.findAndCount({
        where: { workspaceId, status: SubscriptionStatus.DETECTED },
        order: { createdAt: 'DESC' },
        skip,
        take: limit,
      });
      total = count;
      items = rows.map(row => ({
        kind: 'subscription',
        id: row.id,
        vendorName: row.vendorName,
        amount: Number(row.amount),
        currency: row.currency,
        frequency: row.frequency,
        confidence: row.confidence === null ? null : Number(row.confidence),
        nextChargeDate: row.nextChargeDate ? toDateString(row.nextChargeDate) : null,
      }));
    }

    return { kind, counts, items, total, page, limit };
  }

  /**
   * Marks the rows reviewed, with a category when one is given. Goes through
   * the ordinary update so the pick is recorded as manual, learned from, and
   * audited like any other edit.
   */
  async approveTransactions(
    workspaceId: string,
    userId: string,
    ids: string[],
    categoryId?: string,
  ): Promise<{ approved: number }> {
    const updates = { isVerified: true, ...(categoryId ? { categoryId } : {}) };
    const updated = await this.transactionsService.bulkUpdate(
      workspaceId,
      userId,
      ids.map(id => ({ id, updates })),
    );
    await this.closeScanReceipts(workspaceId, updated);
    return { approved: updated.length };
  }

  /**
   * A confirmed scan row settles its receipt too, the way approving the
   * receipt settles the row; otherwise the receipt would still read as waiting.
   */
  private async closeScanReceipts(workspaceId: string, rows: Transaction[]): Promise<void> {
    const rowByStatement = new Map(
      rows.filter(row => row.statementId).map(row => [row.statementId as string, row.id]),
    );
    if (rowByStatement.size === 0) {
      return;
    }
    const receipts = await this.receiptRepository.find({
      select: { id: true, statementId: true },
      where: { workspaceId, statementId: In([...rowByStatement.keys()]), transactionId: IsNull() },
    });
    for (const receipt of receipts) {
      await this.receiptRepository.update(
        { id: receipt.id, workspaceId },
        {
          status: ReceiptStatus.APPROVED,
          transactionId: rowByStatement.get(receipt.statementId as string),
        },
      );
      this.eventEmitter?.emit('receipt.approved', {
        workspaceId,
        receiptId: receipt.id,
        transactionId: rowByStatement.get(receipt.statementId as string) as string,
        mode: 'confirmed_scan',
      } satisfies ReceiptApprovedEvent);
    }
  }

  /**
   * Confirms every row of one statement that has a real category; rows without
   * one, or still in the Uncategorized fallback, stay in the inbox, since
   * confirming them would book spending nowhere.
   */
  async approveStatement(
    workspaceId: string,
    userId: string,
    statementId: string,
  ): Promise<{ approved: number; uncategorized: number }> {
    const statement = await this.statementRepository.findOne({
      where: { id: statementId, workspaceId },
      select: {
        id: true,
      },
    });
    if (!statement) {
      throw new NotFoundException('Statement not found');
    }
    const rows = await this.transactionRepository.find({
      where: { workspaceId, statementId, isVerified: false, isDuplicate: false },
      relations: { category: true },
      select: { id: true, categoryId: true, category: { id: true, name: true } },
    });
    const ready = rows
      .filter(row => row.categoryId && !isUncategorizedName(row.category?.name))
      .map(row => row.id);
    const { approved } =
      ready.length > 0
        ? await this.approveTransactions(workspaceId, userId, ready)
        : { approved: 0 };
    return { approved, uncategorized: rows.length - ready.length };
  }

  async resolveDuplicate(
    workspaceId: string,
    id: string,
    decision: DuplicateDecision,
  ): Promise<{ id: string; isDuplicate: boolean }> {
    const row = await this.transactionRepository.findOne({
      where: { id, workspaceId, isDuplicate: true, duplicateOfId: Not(IsNull()) },
    });
    if (!row) {
      throw new NotFoundException('Suspected duplicate not found');
    }
    if (decision === DuplicateDecision.KEEP) {
      await this.deduplicationService.unmarkDuplicate(id, workspaceId);
      return { id, isDuplicate: false };
    }
    // A confirmed duplicate stays flagged and excluded; "reviewed" just stops the asking.
    await this.transactionRepository.update({ id, workspaceId }, { isVerified: true });
    return { id, isDuplicate: true };
  }
}

function documentOf(
  row: Transaction,
  receiptId: string | null,
  viewerMemberId: string | null,
): ReviewInboxDocument | null {
  // The file shows what the row was as plainly as its redacted descriptor.
  if (!canReadPrivate(row, viewerMemberId)) return null;
  const statement = row.statement;
  if (receiptId) {
    return {
      source: 'receipt',
      id: receiptId,
      fileName: statement?.fileName ?? null,
      fileType: statement?.fileType ?? null,
    };
  }
  if (!statement) return null;
  return {
    source: 'statement',
    id: statement.id,
    fileName: statement.fileName,
    fileType: statement.fileType,
  };
}

function absAmount(row: Transaction): number {
  return Math.abs(Number(row.amount) || Number(row.debit) || Number(row.credit) || 0);
}

function toDateString(value: Date | string): string {
  return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

/**
 * The start (or end) of a `YYYY-MM-DD` day in server time, the way the
 * dashboard bounds its month, so a month here is the same month there.
 */
function localDay(date: string, end = false): Date {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  return end
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);
}

function receiptIssues(receipt: Receipt): string[] {
  const issues = [...(receipt.parsedData?.validationIssues ?? [])];
  if (typeof receipt.parsedData?.amount !== 'number') issues.push('missing_amount');
  if (!receipt.parsedData?.date) issues.push('missing_date');
  if (receipt.metadata?.potentialDuplicates?.length) issues.push('potential_duplicate');
  return issues;
}
