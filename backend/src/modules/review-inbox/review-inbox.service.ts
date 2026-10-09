import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, type Repository, type SelectQueryBuilder } from 'typeorm';
import {
  applyOwnerFilter,
  type OwnerFilter,
  parseReviewerFilter,
} from '../../common/utils/transaction-owner.util';
import { redactPrivateRows } from '../../common/utils/transaction-privacy.util';
import { Receipt, ReceiptSource, ReceiptStatus } from '../../entities/receipt.entity';
import { Statement } from '../../entities/statement.entity';
import { Subscription, SubscriptionStatus } from '../../entities/subscription.entity';
import { Transaction } from '../../entities/transaction.entity';
import { CrossStatementDeduplicationService } from '../transactions/services/cross-statement-deduplication.service';
import { TransactionsService } from '../transactions/transactions.service';
import {
  DuplicateDecision,
  ReviewInboxKind,
  type ReviewInboxQueryDto,
} from './dto/review-inbox.dto';

/** No reviewer asked for: the whole workspace's backlog. */
const ALL_OWNERS: OwnerFilter = { kind: 'all' };

export interface ReviewInboxCounts {
  transaction: number;
  receipt: number;
  duplicate: number;
  subscription: number;
  total: number;
}

export type ReviewInboxItem =
  | {
      kind: 'transaction';
      id: string;
      date: string;
      counterpartyName: string;
      paymentPurpose: string;
      amount: number;
      currency: string;
      transactionType: string;
      categoryId: string | null;
      categoryName: string | null;
      categorySource: string | null;
      categoryReason: string | null;
      statementId: string | null;
      /** The receipt behind the row (a scan, or one attached to it); the page to open. */
      receiptId: string | null;
    }
  | {
      kind: 'receipt';
      id: string;
      date: string | null;
      vendor: string | null;
      amount: number | null;
      currency: string | null;
      issues: string[];
    }
  | {
      kind: 'duplicate';
      id: string;
      date: string;
      counterpartyName: string;
      amount: number;
      currency: string;
      duplicateOfId: string | null;
      confidence: number | null;
      matchType: string | null;
    }
  | {
      kind: 'subscription';
      id: string;
      vendorName: string;
      amount: number;
      currency: string;
      frequency: string;
      confidence: number | null;
      nextChargeDate: string | null;
    };

export interface ReviewInboxPage {
  kind: ReviewInboxKind;
  counts: ReviewInboxCounts;
  items: ReviewInboxItem[];
  total: number;
  page: number;
  limit: number;
}

const DEFAULT_LIMIT = 50;

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
  ) {}

  /**
   * Every row nobody confirmed yet. Only confirmed rows count anywhere in the
   * numbers, so a row a rule, the history or the model categorised still waits
   * here; transfers too. Suspected duplicates have their own list.
   */
  private transactionsQuery(workspaceId: string, reviewer: OwnerFilter = ALL_OWNERS) {
    const query = this.transactionRepository
      .createQueryBuilder('t')
      .leftJoin('t.statement', 's')
      .leftJoinAndSelect('t.category', 'category')
      .where('t.workspaceId = :workspaceId', { workspaceId })
      .andWhere('t.isDuplicate = false')
      .andWhere('t.isVerified = false')
      .andWhere('(t.statementId IS NULL OR s.deletedAt IS NULL)');
    return applyOwnerFilter(query, 't', reviewer);
  }

  private duplicatesQuery(workspaceId: string, reviewer: OwnerFilter = ALL_OWNERS) {
    const query = this.transactionRepository
      .createQueryBuilder('t')
      .leftJoin('t.statement', 's')
      .where('t.workspaceId = :workspaceId', { workspaceId })
      .andWhere('t.isDuplicate = true')
      .andWhere('t.isVerified = false')
      .andWhere("(t.duplicateMatchType IS NULL OR t.duplicateMatchType != 'manual')")
      .andWhere('(t.statementId IS NULL OR s.deletedAt IS NULL)');
    return applyOwnerFilter(query, 't', reviewer);
  }

  private applyDateRange<T extends { andWhere: (sql: string, params?: object) => T }>(
    query: T,
    filters: Pick<ReviewInboxQueryDto, 'from' | 'to'>,
  ): T {
    let result = query;
    if (filters.from) {
      result = result.andWhere('t.transactionDate >= :from', { from: filters.from });
    }
    if (filters.to) {
      result = result.andWhere('t.transactionDate <= :to', { to: filters.to });
    }
    return result;
  }

  /**
   * Receipts not yet turned into a transaction. A flagged one is always listed;
   * the rest once something was parsed from them (an email with no amount is
   * not a receipt yet), or when it is a scan the user uploaded.
   */
  private pendingReceiptsQuery(workspaceId: string): SelectQueryBuilder<Receipt> {
    return this.receiptRepository
      .createQueryBuilder('receipt')
      .where('receipt.workspaceId = :workspaceId', { workspaceId })
      .andWhere('receipt.isDuplicate = false')
      .andWhere('receipt.transactionId IS NULL')
      .andWhere(
        `(receipt.status = :flagged OR (receipt.status IN (:...ready) AND (
            NULLIF(TRIM(receipt.parsed_data->>'amount'), '') IS NOT NULL
            OR (receipt.source = :scan AND receipt.statement_id IS NOT NULL))))`,
        {
          flagged: ReceiptStatus.NEEDS_REVIEW,
          ready: [
            ReceiptStatus.NEW,
            ReceiptStatus.PARSED,
            ReceiptStatus.DRAFT,
            ReceiptStatus.REVIEWED,
          ],
          scan: ReceiptSource.SCAN,
        },
      );
  }

  /**
   * How many rows of each statement still wait here (undecided rows and
   * suspected duplicates), so the documents list can say what is left.
   */
  async pendingByStatement(workspaceId: string): Promise<Record<string, number>> {
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
  ): Promise<ReviewInboxCounts> {
    const [transaction, duplicate, receipt, subscription] = await Promise.all([
      this.transactionsQuery(workspaceId, reviewer).getCount(),
      this.duplicatesQuery(workspaceId, reviewer).getCount(),
      this.pendingReceiptsQuery(workspaceId).getCount(),
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
    filters: ReviewInboxQueryDto,
    selfMemberId: string | null = null,
  ): Promise<ReviewInboxPage> {
    const kind = filters.kind ?? ReviewInboxKind.TRANSACTION;
    const page = filters.page ?? 1;
    const limit = filters.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const reviewer = parseReviewerFilter(filters.reviewer, selfMemberId);
    const counts = await this.counts(workspaceId, reviewer);

    let items: ReviewInboxItem[] = [];
    let total = 0;

    if (kind === ReviewInboxKind.TRANSACTION) {
      const [rows, count] = await this.applyDateRange(
        this.transactionsQuery(workspaceId, reviewer),
        filters,
      )
        .orderBy('t.transactionDate', 'DESC')
        .addOrderBy('t.id', 'ASC')
        .skip(skip)
        .take(limit)
        .getManyAndCount();
      total = count;
      const receiptIds = await this.receiptIdsFor(workspaceId, rows);
      items = redactPrivateRows(rows, selfMemberId).map(row => ({
        kind: 'transaction',
        id: row.id,
        date: toDateString(row.transactionDate),
        counterpartyName: row.counterpartyName,
        paymentPurpose: row.paymentPurpose,
        amount: absAmount(row),
        currency: row.currency,
        transactionType: row.transactionType,
        categoryId: row.categoryId,
        categoryName: row.category?.name ?? null,
        categorySource: row.categorySource,
        categoryReason: row.categoryReason,
        statementId: row.statementId,
        receiptId:
          receiptIds.byTransaction.get(row.id) ??
          (row.statementId ? receiptIds.byStatement.get(row.statementId) : undefined) ??
          null,
      }));
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
      }));
    } else if (kind === ReviewInboxKind.RECEIPT) {
      const query = this.pendingReceiptsQuery(workspaceId);
      if (filters.from) {
        query.andWhere('receipt.createdAt >= :from', { from: new Date(filters.from) });
      }
      if (filters.to) {
        query.andWhere('receipt.createdAt <= :to', { to: endOfDay(filters.to) });
      }
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
    return { approved: updated.length };
  }

  /**
   * Confirms every row of one statement that has a category; rows without one
   * stay in the inbox, since confirming them would book spending nowhere.
   */
  async approveStatement(
    workspaceId: string,
    userId: string,
    statementId: string,
  ): Promise<{ approved: number; uncategorized: number }> {
    const statement = await this.statementRepository.findOne({
      where: { id: statementId, workspaceId },
      select: ['id'],
    });
    if (!statement) {
      throw new NotFoundException('Statement not found');
    }
    const rows = await this.transactionRepository.find({
      where: { workspaceId, statementId, isVerified: false, isDuplicate: false },
      select: ['id', 'categoryId'],
    });
    const ready = rows.filter(row => row.categoryId).map(row => row.id);
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

function absAmount(row: Transaction): number {
  return Math.abs(Number(row.amount) || Number(row.debit) || Number(row.credit) || 0);
}

function toDateString(value: Date | string): string {
  return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

function endOfDay(date: string): Date {
  const end = new Date(date);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

function receiptIssues(receipt: Receipt): string[] {
  const issues = [...(receipt.parsedData?.validationIssues ?? [])];
  if (typeof receipt.parsedData?.amount !== 'number') issues.push('missing_amount');
  if (!receipt.parsedData?.date) issues.push('missing_date');
  if (receipt.metadata?.potentialDuplicates?.length) issues.push('potential_duplicate');
  return issues;
}
