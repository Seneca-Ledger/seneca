import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  type FindOperator,
  In,
  IsNull,
  type Repository,
  type SelectQueryBuilder,
} from 'typeorm';
import { flowsSql, onlyFlows } from '../../common/utils/counted-transactions.util';
import { currencyCodeOrDefault } from '../../common/utils/currency.util';
import {
  canReadPrivate,
  PRIVACY_VIEWER_PARAM,
  PRIVATE_PLACEHOLDER,
  redactedSql,
} from '../../common/utils/transaction-privacy.util';
import type {
  DashboardActionItem,
  DashboardCashFlowEntriesResponse,
  DashboardCashFlowEntry,
  DashboardCashFlowPoint,
  DashboardCommitmentDay,
  DashboardCommitmentItem,
  DashboardCommitmentsResponse,
  DashboardDataHealth,
  DashboardFinancialSnapshot,
  DashboardMonthlyCashFlowResponse,
  DashboardRecentTransaction,
  DashboardResponse,
  DashboardTopCategory,
  DashboardTopMerchant,
  DashboardTrendsResponse,
} from '../../contracts';
import { Payable, PayableDirection, PayableStatus } from '../../entities/payable.entity';
import { Receipt, ReceiptStatus } from '../../entities/receipt.entity';
import { BankName, Statement, StatementStatus } from '../../entities/statement.entity';
import {
  Subscription,
  SubscriptionFrequency,
  SubscriptionStatus,
} from '../../entities/subscription.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { Workspace } from '../../entities/workspace.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import {
  pendingReceiptsQuery,
  QUEUE_DATE_COLUMN,
  reviewDuplicatesQuery,
  uncategorizedRowsQuery,
  unconfirmedRowsQuery,
} from '../review-inbox/review-queue.queries';
import { documentHref, findScanReceipts } from '../search/document-href';
import {
  type CashFlowRange,
  type DashboardWindow,
  daysInMonth,
  getCashFlowRangeBounds,
  getMonthWindowBounds,
  getWindowBounds,
  parseMonthWindow,
} from './dashboard-window.util';

/** How many individual categories the donut shows before folding the rest into "Other". */
const TOP_CATEGORIES_LIMIT = 8;
/** Neutral swatch for categories with no color set and for the "Other" bucket. */
const OTHER_CATEGORY_COLOR = '#898781';
/** Internal grouping key for transactions with no category — never sent to the client. */
const UNCATEGORIZED_KEY = '__uncategorized__';
/**
 * Which history counter a statement in each status feeds. What waits for review
 * is counted from the Review queue itself (its rows), not from statement statuses.
 */
/** A period's trends, every amount already in the workspace currency. */
interface TrendRows {
  daily: Map<string, DashboardCashFlowPoint>;
  categories: Array<{
    name: string;
    color: string | null;
    icon: string | null;
    amount: number;
    count: number;
  }>;
  counterparties: Array<{ name: string; amount: number; count: number }>;
  totals: { income: number; expense: number; rows: number };
}

/** The categories and payers a period's trends list. */
const TREND_LIST_LIMIT = 10;

/** Rows for the recent-transactions card with the row to itself; a half-width card shows six. */
const RECENT_TRANSACTIONS_LIMIT = 12;
/** Upper bound on the commitments projection so a client can't request a decade of days. */
const MAX_COMMITMENT_HORIZON_DAYS = 365;
/** Bank names are proper nouns and aren't translated per locale. */
const BANK_DISPLAY_NAMES: Record<BankName, string> = {
  [BankName.KASPI]: 'Kaspi',
  [BankName.BEREKE_NEW]: 'Bereke Bank',
  [BankName.BEREKE_OLD]: 'Bereke Bank',
  [BankName.HAPOALIM]: 'Bank Hapoalim',
  [BankName.OTHER]: 'Bank',
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function maskAccountNumber(accountNumber: string | null): string | null {
  if (!accountNumber) {
    return null;
  }
  const digitsOnly = accountNumber.replace(/\D/g, '');
  const last4 = digitsOnly.slice(-4) || accountNumber.slice(-4);
  return `•••• ${last4}`;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(Statement)
    private readonly statementRepo: Repository<Statement>,
    @InjectRepository(Payable)
    private readonly payableRepo: Repository<Payable>,
    @InjectRepository(Receipt)
    private readonly receiptRepo: Repository<Receipt>,
    @InjectRepository(WorkspaceMember)
    private readonly memberRepo: Repository<WorkspaceMember>,
    @InjectRepository(Workspace)
    private readonly workspaceRepo: Repository<Workspace>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {}

  async getDashboard(
    userId: string,
    workspaceId: string,
    range: '7d' | '30d' | '90d' | 'month' = '30d',
    endDateParam?: string,
    viewerMemberId: string | null = null,
  ): Promise<DashboardResponse> {
    const isMonth = range === 'month';
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    const anchorDate = endDateParam ? new Date(endDateParam) : new Date();

    const requestedWindow = isMonth
      ? getMonthWindowBounds(anchorDate)
      : getWindowBounds(days, anchorDate);

    const [initialSnapshot, memberRole] = await Promise.all([
      this.getSnapshot(workspaceId, requestedWindow.since, requestedWindow.endDate),
      this.getMemberRole(userId, workspaceId),
    ]);

    let snapshot = initialSnapshot;
    let effectiveWindow = requestedWindow;
    let autoShifted = false;

    if (!endDateParam && snapshot.income30d === 0 && snapshot.expense30d === 0) {
      const latestTransactionDate = await this.getLatestTransactionDate(workspaceId);

      if (latestTransactionDate) {
        effectiveWindow = isMonth
          ? getMonthWindowBounds(latestTransactionDate)
          : getWindowBounds(days, latestTransactionDate);
        snapshot = await this.getSnapshot(
          workspaceId,
          effectiveWindow.since,
          effectiveWindow.endDate,
        );
        autoShifted = true;
      }
    }

    // A calendar month is always under 90 days, so this naturally keeps
    // cash-flow buckets daily (see getTransactionGroupFormat) for month mode.
    const bucketDays = isMonth ? daysInMonth(effectiveWindow.since) : days;

    // The month dashboard counts its queues (the month close) for that month too;
    // the rolling 7d/30d/90d ranges keep the live, all-time queue totals.
    const queueWindow = isMonth ? effectiveWindow : null;

    const [cashFlow, topMerchants, topCategories, recentTransactions, actions, dataHealth] =
      await Promise.all([
        this.getCashFlow(workspaceId, effectiveWindow.since, effectiveWindow.endDate, bucketDays),
        this.getTopMerchants(
          workspaceId,
          effectiveWindow.since,
          effectiveWindow.endDate,
          viewerMemberId,
        ),
        this.getTopCategories(workspaceId, effectiveWindow.since, effectiveWindow.endDate),
        this.getRecentTransactions(
          workspaceId,
          effectiveWindow.since,
          effectiveWindow.endDate,
          viewerMemberId,
        ),
        this.getActions(userId, workspaceId, queueWindow),
        this.getDataHealth(workspaceId, queueWindow),
      ]);

    const response: DashboardResponse = {
      snapshot,
      actions,
      cashFlow,
      topMerchants,
      topCategories,
      recentTransactions,
      role: memberRole,
      range,
      dataHealth,
    };

    if (autoShifted) {
      response.effectiveEndDate = this.formatDateOnly(effectiveWindow.endDate);
      response.effectiveSince = this.formatDateOnly(effectiveWindow.since);
    }

    return response;
  }

  private async getSnapshot(
    workspaceId: string,
    since: Date,
    endDate: Date,
  ): Promise<DashboardFinancialSnapshot> {
    const workspace = await this.workspaceRepo.findOne({
      where: { id: workspaceId },
      select: {
        currency: true,
      },
    });
    const targetCurrency = this.normalizeCurrency(workspace?.currency);

    // Group income/expense by currency so we can convert each group
    const txRows = await this.transactionRepo
      .createQueryBuilder('t')
      // Rows without a statement (a cash payment, an approved receipt) count too.
      .leftJoin('t.statement', 's')
      .select([
        't.currency AS currency',
        // Income and expense count confirmed rows only; unapproved cash below is
        // what still waits, so it keeps the unconfirmed ones on purpose.
        `COALESCE(SUM(CASE WHEN t.transactionType = :income AND ${flowsSql('t')} THEN t.credit ELSE 0 END), 0) AS income`,
        `COALESCE(SUM(CASE WHEN t.transactionType = :expense AND ${flowsSql('t')} THEN t.debit ELSE 0 END), 0) AS expense`,
        'COALESCE(SUM(CASE WHEN s.status IN (:...unapprovedStatuses) THEN (CASE WHEN t.transactionType = :income THEN t.credit ELSE -t.debit END) ELSE 0 END), 0) AS "unapprovedCash"',
      ])
      .where('t.workspaceId = :workspaceId', { workspaceId })
      .andWhere('t.transactionDate BETWEEN :since AND :endDate', { since, endDate })
      .andWhere('t.isDuplicate = false')
      .andWhere('t.transferPairId IS NULL')
      .andWhere(
        '(s.id IS NULL OR (s.deletedAt IS NULL AND s.status NOT IN (:...excludedStatuses)))',
        {
          excludedStatuses: [StatementStatus.ERROR, StatementStatus.PROCESSING],
        },
      )
      .setParameter('income', TransactionType.INCOME)
      .setParameter('expense', TransactionType.EXPENSE)
      .setParameter('unapprovedStatuses', [
        StatementStatus.UPLOADED,
        StatementStatus.PARSED,
        StatementStatus.VALIDATED,
      ])
      .groupBy('t.currency')
      .getRawMany<{ currency: string; income: string; expense: string; unapprovedCash: string }>();

    let income = 0;
    let expense = 0;
    let unapprovedCash = 0;
    for (const row of txRows) {
      income += await this.convertDashboardAmount(
        row.income,
        row.currency,
        targetCurrency,
        workspaceId,
      );
      expense += await this.convertDashboardAmount(
        row.expense,
        row.currency,
        targetCurrency,
        workspaceId,
      );
      unapprovedCash += await this.convertDashboardAmount(
        row.unapprovedCash,
        row.currency,
        targetCurrency,
        workspaceId,
      );
    }

    const totalBalance = await this.getAllTimeBalance(workspaceId, targetCurrency);

    const payableRows = await this.payableRepo
      .createQueryBuilder('p')
      .select([
        'p.currency AS currency',
        'COALESCE(SUM(CASE WHEN p.status IN (:...payStatuses) THEN p.amount ELSE 0 END), 0) AS "totalPayable"',
        'COALESCE(SUM(CASE WHEN p.status = :overdue THEN p.amount ELSE 0 END), 0) AS "totalOverdue"',
      ])
      .where('p.workspaceId = :workspaceId', { workspaceId })
      .andWhere('p.deletedAt IS NULL')
      .andWhere('p.direction = :direction', { direction: PayableDirection.PAYABLE })
      .setParameter('payStatuses', [PayableStatus.TO_PAY, PayableStatus.SCHEDULED])
      .setParameter('overdue', PayableStatus.OVERDUE)
      .groupBy('p.currency')
      .getRawMany<{ currency: string; totalPayable: string; totalOverdue: string }>();

    let totalPayable = 0;
    let totalOverdue = 0;
    for (const row of payableRows) {
      totalPayable += await this.convertDashboardAmount(
        row.totalPayable,
        row.currency,
        targetCurrency,
        workspaceId,
      );
      totalOverdue += await this.convertDashboardAmount(
        row.totalOverdue,
        row.currency,
        targetCurrency,
        workspaceId,
      );
    }

    // Rows in a currency with no rate were counted at face value above; say so.
    const coverage =
      (await this.exchangeRatesService.coverageForWorkspace(workspaceId, targetCurrency)) ?? [];
    const missingRates = coverage.filter(item => item.rate === null).map(item => item.currency);

    return {
      totalBalance,
      income30d: income,
      expense30d: expense,
      netFlow30d: income - expense,
      totalPayable,
      totalOverdue,
      unapprovedCash,
      currency: targetCurrency,
      missingRates,
    };
  }

  /** All-time net of every approved transaction, converted into `targetCurrency`. */
  private async getAllTimeBalance(workspaceId: string, targetCurrency: string): Promise<number> {
    const balanceQuery = this.transactionRepo.createQueryBuilder('t').leftJoin('t.statement', 's');
    this.applyWorkspaceStatementFilters(balanceQuery, workspaceId, true);

    const balanceRows = await balanceQuery
      .select([
        't.currency AS currency',
        `COALESCE(SUM(CASE WHEN t.transactionType = :balIncome THEN t.credit WHEN t.transactionType = :balExpense THEN -t.debit ELSE 0 END), 0) AS "balance"`,
      ])
      .setParameter('balIncome', TransactionType.INCOME)
      .setParameter('balExpense', TransactionType.EXPENSE)
      .groupBy('t.currency')
      .getRawMany<{ currency: string; balance: string }>();

    let totalBalance = 0;
    for (const row of balanceRows) {
      totalBalance += await this.convertDashboardAmount(
        row.balance,
        row.currency,
        targetCurrency,
        workspaceId,
      );
    }
    return totalBalance;
  }

  private normalizeCurrency(currency: string | null | undefined): string {
    return currencyCodeOrDefault(currency);
  }

  private async convertDashboardAmount(
    amount: string | number | null | undefined,
    sourceCurrency: string | null | undefined,
    targetCurrency: string,
    workspaceId: string,
  ): Promise<number> {
    const value = typeof amount === 'number' ? amount : Number.parseFloat(amount ?? '');
    if (!Number.isFinite(value) || value === 0) {
      return 0;
    }
    const source = this.normalizeCurrency(sourceCurrency);
    if (source === targetCurrency) {
      return value;
    }
    const rate = await this.exchangeRatesService.getRate(
      source,
      targetCurrency,
      undefined,
      workspaceId,
    );
    return value * rate;
  }

  private async getWorkspaceCurrency(workspaceId: string): Promise<string> {
    const workspace = await this.workspaceRepo.findOne({
      where: { id: workspaceId },
      select: {
        currency: true,
      },
    });
    return this.normalizeCurrency(workspace?.currency);
  }

  private async getActions(
    _userId: string,
    workspaceId: string,
    window: DashboardWindow | null = null,
  ): Promise<DashboardActionItem[]> {
    const actions: DashboardActionItem[] = [];

    const pendingSubmit = await this.statementRepo.count({
      where: {
        workspaceId,
        status: StatementStatus.UPLOADED,
        deletedAt: IsNull(),
        ...this.inWindow('createdAt', window),
      },
    });

    if (pendingSubmit > 0) {
      actions.push({
        type: 'statements_pending_submit',
        count: pendingSubmit,
        label: `${pendingSubmit} statement${pendingSubmit > 1 ? 's' : ''} pending submit`,
        href: '/statements/submit',
      });
    }

    const pendingReview = await this.statementRepo.count({
      where: {
        workspaceId,
        status: In([StatementStatus.PARSED, StatementStatus.VALIDATED]),
        deletedAt: IsNull(),
        ...this.inWindow('createdAt', window),
      },
    });

    if (pendingReview > 0) {
      actions.push({
        type: 'statements_pending_review',
        count: pendingReview,
        label: `${pendingReview} statement${pendingReview > 1 ? 's' : ''} need review`,
        href: '/statements/approve',
      });
    }

    const overduePayments = await this.payableRepo.count({
      where: {
        workspaceId,
        status: PayableStatus.OVERDUE,
        deletedAt: IsNull(),
        ...this.inWindow('dueDate', window),
      },
    });

    if (overduePayments > 0) {
      actions.push({
        type: 'payments_overdue',
        count: overduePayments,
        label: `${overduePayments} payment${overduePayments > 1 ? 's' : ''} overdue`,
        href: '/statements/pay?status=overdue',
      });
    }

    // Counts transactions *and* receipts, so the label stays on "items".
    const uncategorized = await this.getUncategorizedCount(workspaceId, window);

    if (uncategorized > 0) {
      actions.push({
        type: 'transactions_uncategorized',
        count: uncategorized,
        label: `${uncategorized} item${uncategorized > 1 ? 's' : ''} uncategorized`,
        href: '/statements/submit?categoryId=uncategorized',
      });
    }

    const pendingReceipts = await this.receiptRepo.count({
      where: {
        workspaceId,
        status: In([ReceiptStatus.NEW, ReceiptStatus.NEEDS_REVIEW]),
        ...this.inWindow('receivedAt', window),
      },
    });

    if (pendingReceipts > 0) {
      actions.push({
        type: 'receipts_pending_review',
        count: pendingReceipts,
        label: `${pendingReceipts} receipt${pendingReceipts > 1 ? 's' : ''} need review`,
        href: '/statements/submit?status=needs_review',
      });
    }

    return actions;
  }

  private async getCashFlow(
    workspaceId: string,
    since: Date,
    endDate: Date,
    days: number,
  ): Promise<DashboardCashFlowPoint[]> {
    const targetCurrency = await this.getWorkspaceCurrency(workspaceId);
    const points = await this.sumCashFlowByBucket(
      workspaceId,
      since,
      endDate,
      this.getTransactionGroupFormat(days),
      targetCurrency,
    );
    return this.fillCashFlowWindow(points, since, endDate, days);
  }

  /**
   * Monthly income/expense over whole calendar months, for the Trends cash-flow card. Every range
   * ends at `month` (YYYY-MM, the dashboard's picked month), or at the current month without one.
   */
  async getMonthlyCashFlow(
    workspaceId: string,
    range: CashFlowRange,
    month?: string,
  ): Promise<DashboardMonthlyCashFlowResponse> {
    const [currency, earliest] = await Promise.all([
      this.getWorkspaceCurrency(workspaceId),
      range === 'all' ? this.getEarliestTransactionDate(workspaceId) : Promise.resolve(null),
    ]);
    const anchor = parseMonthWindow(month)?.since ?? new Date();
    const window = getCashFlowRangeBounds(range, anchor, earliest);
    if (!window) {
      return {
        range,
        currency,
        since: null,
        endDate: null,
        totals: { income: 0, expense: 0, net: 0 },
        points: [],
      };
    }

    const sums = await this.sumCashFlowByBucket(
      workspaceId,
      window.since,
      window.endDate,
      "'YYYY-MM'",
      currency,
    );
    const points =
      sums.size === 0
        ? []
        : this.buildMonthlyBuckets(window.since, window.endDate).map(month => {
            const income = round2(sums.get(month)?.income ?? 0);
            const expense = round2(sums.get(month)?.expense ?? 0);
            return { month, income, expense, net: round2(income - expense) };
          });
    const income = round2(points.reduce((sum, point) => sum + point.income, 0));
    const expense = round2(points.reduce((sum, point) => sum + point.expense, 0));

    return {
      range,
      currency,
      since: this.formatDateOnly(window.since),
      endDate: this.formatDateOnly(window.endDate),
      totals: { income, expense, net: round2(income - expense) },
      points,
    };
  }

  /**
   * The rows behind one month's daily cash flow, named, for the card's day tooltip. Same filters
   * and sides as `sumCashFlowByBucket`, so the names add up to the bar they sit on.
   */
  async getCashFlowEntries(
    workspaceId: string,
    month: string,
    viewerMemberId: string | null,
  ): Promise<DashboardCashFlowEntriesResponse> {
    const window = parseMonthWindow(month);
    if (!window) {
      return { entries: [] };
    }
    const currency = await this.getWorkspaceCurrency(workspaceId);
    const query = this.transactionRepo.createQueryBuilder('t').leftJoin('t.statement', 's');
    this.applyActiveStatementTransactionFilters(query, workspaceId, window.since, window.endDate);

    const rows = await query
      .select("TO_CHAR(t.transactionDate, 'YYYY-MM-DD')", 'date')
      .addSelect('t.counterpartyName', 'counterpartyName')
      .addSelect('s.fileName', 'fileName')
      .addSelect('t.transactionType', 'transactionType')
      .addSelect('t.debit', 'debit')
      .addSelect('t.credit', 'credit')
      .addSelect('t.currency', 'currency')
      .addSelect('t.isPrivate', 'isPrivate')
      .addSelect('t.ownerMemberId', 'ownerMemberId')
      .andWhere('t.transactionType IN (:...sides)', {
        sides: [TransactionType.INCOME, TransactionType.EXPENSE],
      })
      .getRawMany<{
        date: string;
        counterpartyName: string | null;
        fileName: string | null;
        transactionType: TransactionType;
        debit: string | null;
        credit: string | null;
        currency: string;
        isPrivate: boolean;
        ownerMemberId: string | null;
      }>();

    const entries: DashboardCashFlowEntry[] = [];
    for (const row of rows) {
      const kind = row.transactionType === TransactionType.INCOME ? 'income' : 'expense';
      const raw = kind === 'income' ? row.credit : row.debit;
      const amount = round2(
        await this.convertDashboardAmount(raw ?? '0', row.currency, currency, workspaceId),
      );
      if (amount <= 0) {
        continue;
      }
      const name = canReadPrivate(row, viewerMemberId)
        ? row.counterpartyName?.trim() || row.fileName?.trim() || PRIVATE_PLACEHOLDER
        : PRIVATE_PLACEHOLDER;
      entries.push({ date: row.date, name, kind, amount });
    }
    entries.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);
    return { entries };
  }

  /** Income/expense per `TO_CHAR` bucket, every currency converted into `targetCurrency`. */
  private async sumCashFlowByBucket(
    workspaceId: string,
    since: Date,
    endDate: Date,
    groupFormat: string,
    targetCurrency: string,
  ): Promise<Map<string, DashboardCashFlowPoint>> {
    const query = this.transactionRepo.createQueryBuilder('t').leftJoin('t.statement', 's');

    this.applyActiveStatementTransactionFilters(query, workspaceId, since, endDate);

    const result = await query
      .select(`TO_CHAR(t.transactionDate, ${groupFormat})`, 'date')
      .addSelect('t.currency', 'currency')
      .addSelect(
        'COALESCE(SUM(CASE WHEN t.transactionType = :income THEN t.credit ELSE 0 END), 0)',
        'income',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN t.transactionType = :expense THEN t.debit ELSE 0 END), 0)',
        'expense',
      )
      .groupBy(`TO_CHAR(t.transactionDate, ${groupFormat})`)
      .addGroupBy('t.currency')
      .orderBy(`TO_CHAR(t.transactionDate, ${groupFormat})`, 'ASC')
      .setParameter('income', TransactionType.INCOME)
      .setParameter('expense', TransactionType.EXPENSE)
      .getRawMany<{ date: string; currency: string; income: string; expense: string }>();

    const points = new Map<string, DashboardCashFlowPoint>();
    for (const row of result) {
      const point = points.get(row.date) ?? { date: row.date, income: 0, expense: 0 };
      point.income += await this.convertDashboardAmount(
        row.income,
        row.currency,
        targetCurrency,
        workspaceId,
      );
      point.expense += await this.convertDashboardAmount(
        row.expense,
        row.currency,
        targetCurrency,
        workspaceId,
      );
      points.set(row.date, point);
    }

    return points;
  }

  private async getTopMerchants(
    workspaceId: string,
    since: Date,
    endDate: Date,
    viewerMemberId: string | null,
  ): Promise<DashboardTopMerchant[]> {
    const targetCurrency = await this.getWorkspaceCurrency(workspaceId);
    const query = this.transactionRepo.createQueryBuilder('t').leftJoin('t.statement', 's');

    this.applyActiveStatementTransactionFilters(query, workspaceId, since, endDate);

    // Another member's private rows count under the placeholder, not their merchant.
    const name = redactedSql('t', 't.counterparty_name');
    const result = await query
      .select(name, 'name')
      .addSelect('t.currency', 'currency')
      .addSelect('COALESCE(SUM(t.debit), 0)', 'amount')
      .addSelect('COUNT(t.id)', 'count')
      .andWhere('t.transactionType = :expense', { expense: TransactionType.EXPENSE })
      .andWhere('t.counterpartyName IS NOT NULL')
      .andWhere("t.counterpartyName != ''")
      .groupBy(name)
      .addGroupBy('t.currency')
      .orderBy('amount', 'DESC')
      .setParameter(PRIVACY_VIEWER_PARAM, viewerMemberId)
      .getRawMany<{ name: string; currency: string; amount: string; count: string }>();

    const rows = new Map<string, DashboardTopMerchant>();
    for (const row of result) {
      const key = row.name;
      const existing = rows.get(key) ?? { name: key, amount: 0, count: 0 };
      existing.amount += await this.convertDashboardAmount(
        row.amount,
        row.currency,
        targetCurrency,
        workspaceId,
      );
      existing.count += Number.parseInt(row.count, 10) || 0;
      rows.set(key, existing);
    }

    return Array.from(rows.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }

  private async getTopCategories(
    workspaceId: string,
    since: Date,
    endDate: Date,
  ): Promise<DashboardTopCategory[]> {
    const targetCurrency = await this.getWorkspaceCurrency(workspaceId);
    const query = this.transactionRepo
      .createQueryBuilder('t')
      .leftJoin('t.statement', 's')
      .leftJoin('t.category', 'c');

    this.applyActiveStatementTransactionFilters(query, workspaceId, since, endDate);

    const result = await query
      .select('c.id', 'id')
      .addSelect('c.name', 'name')
      .addSelect('c.color', 'color')
      .addSelect('c.icon', 'icon')
      .addSelect('t.currency', 'currency')
      .addSelect('COALESCE(SUM(t.debit), 0)', 'amount')
      .addSelect('COUNT(t.id)', 'count')
      .andWhere('t.transactionType = :expense', { expense: TransactionType.EXPENSE })
      .groupBy('c.id')
      .addGroupBy('c.name')
      .addGroupBy('c.color')
      .addGroupBy('c.icon')
      .addGroupBy('t.currency')
      .orderBy('amount', 'DESC')
      .getRawMany<{
        id: string | null;
        name: string | null;
        color: string | null;
        icon: string | null;
        currency: string;
        amount: string;
        count: string;
      }>();

    type Aggregate = Omit<DashboardTopCategory, 'percent'>;
    const rows = new Map<string, Aggregate>();
    for (const row of result) {
      const key = row.id || UNCATEGORIZED_KEY;
      const existing = rows.get(key) ?? {
        id: row.id || null,
        name: row.name,
        color: row.color || OTHER_CATEGORY_COLOR,
        icon: row.icon || null,
        amount: 0,
        count: 0,
      };
      existing.amount += await this.convertDashboardAmount(
        row.amount,
        row.currency,
        targetCurrency,
        workspaceId,
      );
      existing.count += Number.parseInt(row.count, 10) || 0;
      rows.set(key, existing);
    }

    const sorted = Array.from(rows.values()).sort((a, b) => b.amount - a.amount);
    const total = sorted.reduce((sum, row) => sum + row.amount, 0);
    if (total <= 0) {
      return [];
    }

    const top = sorted.slice(0, TOP_CATEGORIES_LIMIT);
    const rest = sorted.slice(TOP_CATEGORIES_LIMIT);

    const withPercent: DashboardTopCategory[] = top.map(row => ({
      ...row,
      percent: round2((row.amount / total) * 100),
    }));

    if (rest.length > 0) {
      const otherAmount = rest.reduce((sum, row) => sum + row.amount, 0);
      const otherCount = rest.reduce((sum, row) => sum + row.count, 0);
      // Absorbing the rounding remainder here (rather than computing this
      // bucket's percent from its own amount) guarantees the displayed
      // percentages always sum to exactly 100.
      const otherPercent = round2(100 - withPercent.reduce((sum, row) => sum + row.percent, 0));
      withPercent.push({
        id: null,
        name: null,
        isOther: true,
        color: OTHER_CATEGORY_COLOR,
        icon: null,
        amount: otherAmount,
        count: otherCount,
        percent: otherPercent,
      });
    }

    return withPercent;
  }

  private async getRecentTransactions(
    workspaceId: string,
    since: Date,
    endDate: Date,
    viewerMemberId: string | null,
  ): Promise<DashboardRecentTransaction[]> {
    const targetCurrency = await this.getWorkspaceCurrency(workspaceId);
    const query = this.transactionRepo
      .createQueryBuilder('t')
      .leftJoin('t.statement', 's')
      .leftJoin('t.category', 'c');

    this.applyActiveStatementTransactionFilters(query, workspaceId, since, endDate);

    const rows = await query
      .select('t.id', 'id')
      .addSelect(redactedSql('t', 't.counterparty_name'), 'description')
      .addSelect('t.debit', 'debit')
      .addSelect('t.credit', 'credit')
      .addSelect('t.transactionType', 'transactionType')
      .addSelect('t.currency', 'currency')
      .addSelect("TO_CHAR(t.transactionDate, 'YYYY-MM-DD')", 'date')
      .addSelect('c.id', 'categoryId')
      .addSelect('c.name', 'categoryName')
      .addSelect('c.color', 'categoryColor')
      .addSelect('c.icon', 'categoryIcon')
      .addSelect('s.bankName', 'bankName')
      .addSelect('s.accountNumber', 'accountNumber')
      .addSelect('s.id', 'statementId')
      .addSelect('s.status', 'statementStatus')
      .addSelect('s.parsingDetails', 'parsingDetails')
      .orderBy('t.transactionDate', 'DESC')
      .addOrderBy('t.createdAt', 'DESC')
      .limit(RECENT_TRANSACTIONS_LIMIT)
      .setParameter(PRIVACY_VIEWER_PARAM, viewerMemberId)
      .getRawMany<{
        id: string;
        description: string;
        debit: string | null;
        credit: string | null;
        transactionType: TransactionType;
        currency: string;
        date: string;
        categoryId: string | null;
        categoryName: string | null;
        categoryColor: string | null;
        categoryIcon: string | null;
        bankName: BankName;
        accountNumber: string | null;
        statementId: string | null;
        statementStatus: Statement['status'];
        parsingDetails: Statement['parsingDetails'];
      }>();

    // A transaction has no page of its own: a click opens its document. One
    // entered by hand has none, so it gets no link rather than a dead one.
    const documents = rows.map(row =>
      row.statementId
        ? { id: row.statementId, status: row.statementStatus, parsingDetails: row.parsingDetails }
        : null,
    );
    const scanReceipts = await findScanReceipts(
      this.receiptRepo,
      workspaceId,
      documents.filter(document => document !== null),
    );

    return Promise.all(
      rows.map(async (row, index) => {
        const magnitude = row.transactionType === TransactionType.INCOME ? row.credit : row.debit;
        const converted = await this.convertDashboardAmount(
          magnitude,
          row.currency,
          targetCurrency,
          workspaceId,
        );
        const amount = row.transactionType === TransactionType.INCOME ? converted : -converted;

        const bankLabel = BANK_DISPLAY_NAMES[row.bankName] ?? BANK_DISPLAY_NAMES[BankName.OTHER];
        const maskedAccount = maskAccountNumber(row.accountNumber);
        const account = maskedAccount ? `${bankLabel} ${maskedAccount}` : bankLabel;

        return {
          id: row.id,
          description: row.description,
          amount,
          currency: targetCurrency,
          date: row.date,
          account,
          categoryId: row.categoryId,
          categoryName: row.categoryName,
          categoryColor: row.categoryColor || OTHER_CATEGORY_COLOR,
          categoryIcon: row.categoryIcon,
          href: documents[index] ? documentHref(documents[index], scanReceipts) : null,
        };
      }),
    );
  }

  private async getMemberRole(
    userId: string,
    workspaceId: string,
  ): Promise<'owner' | 'admin' | 'member' | 'viewer'> {
    const member = await this.memberRepo.findOne({
      where: { userId, workspaceId },
      select: {
        role: true,
      },
    });

    return (member?.role as 'owner' | 'admin' | 'member' | 'viewer') || 'member';
  }

  /**
   * With a `window`, every queue is limited to items dated inside it (statements by upload,
   * transactions by date, receipts by receipt date); without one the totals are live and
   * all-time. `lastUploadDate` is always all-time — it drives the "never uploaded" empty state.
   */
  private async getDataHealth(
    workspaceId: string,
    window: DashboardWindow | null = null,
  ): Promise<DashboardDataHealth> {
    const [
      uncategorizedTransactions,
      statementsWithErrors,
      statementsPendingReview,
      statementsPendingSubmit,
      receiptsPendingReview,
      parsingWarnings,
      latestStatement,
      unapprovedCash,
    ] = await Promise.all([
      this.getUncategorizedCount(workspaceId, window),
      // statements with errors
      this.statementRepo.count({
        where: {
          workspaceId,
          status: StatementStatus.ERROR,
          deletedAt: IsNull(),
          ...this.inWindow('createdAt', window),
        },
      }),
      // What Review still asks about: unconfirmed rows and possible duplicates,
      // by the queue's own rules, so the number is the one Review shows.
      this.getReviewRowsCount(workspaceId, window),
      // statements pending submit: uploaded but not submitted yet
      this.statementRepo.count({
        where: {
          workspaceId,
          status: StatementStatus.UPLOADED,
          deletedAt: IsNull(),
          ...this.inWindow('createdAt', window),
        },
      }),
      // receipts Review lists, by its own rule
      this.withinWindow(
        pendingReceiptsQuery(this.receiptRepo, workspaceId),
        QUEUE_DATE_COLUMN.receipt,
        window,
      ).getCount(),
      // parsing warnings: actual warnings captured in parsing details
      this.withinWindow(
        this.createParsingWarningsQuery(workspaceId),
        's.createdAt',
        window,
      ).getCount(),
      // latest statement upload date
      this.statementRepo.findOne({
        where: { workspaceId, deletedAt: IsNull() },
        order: { createdAt: 'DESC' },
        select: {
          createdAt: true,
        },
      }),
      // money in rows nobody has confirmed yet
      this.getUnconfirmedCash(workspaceId, window),
    ]);

    return {
      uncategorizedTransactions,
      statementsWithErrors,
      statementsPendingReview,
      statementsPendingSubmit,
      receiptsPendingReview,
      unapprovedCash,
      lastUploadDate: latestStatement?.createdAt?.toISOString() ?? null,
      parsingWarnings,
    };
  }

  /** Rows waiting in Review (unconfirmed plus possible duplicates), dated within `window`. */
  private async getReviewRowsCount(
    workspaceId: string,
    window: DashboardWindow | null,
  ): Promise<number> {
    const [rows, duplicates] = await Promise.all(
      [unconfirmedRowsQuery, reviewDuplicatesQuery].map(query =>
        this.withinWindow(
          query(this.transactionRepo, workspaceId),
          QUEUE_DATE_COLUMN.row,
          window,
        ).getCount(),
      ),
    );
    return rows + duplicates;
  }

  /**
   * Income minus spending in the rows Review still asks about, in the workspace
   * currency: the money the numbers elsewhere leave out until someone confirms it.
   */
  private async getUnconfirmedCash(
    workspaceId: string,
    window: DashboardWindow | null,
  ): Promise<number> {
    const rows = await this.withinWindow(
      unconfirmedRowsQuery(this.transactionRepo, workspaceId),
      't.transactionDate',
      window,
    )
      .select('t.currency', 'currency')
      .addSelect(
        'COALESCE(SUM(CASE WHEN t.transactionType = :income THEN t.credit ELSE -t.debit END), 0)',
        'amount',
      )
      .setParameter('income', TransactionType.INCOME)
      .groupBy('t.currency')
      .getRawMany<{ currency: string; amount: string }>();
    const targetCurrency = await this.getWorkspaceCurrency(workspaceId);
    let total = 0;
    for (const row of rows) {
      total += await this.convertDashboardAmount(
        row.amount,
        row.currency,
        targetCurrency,
        workspaceId,
      );
    }
    return total;
  }

  /**
   * Rows with no category, by the rule Review lists them with. A receipt is not
   * counted on its own: one that booked a row is that row, one that has not is
   * still a receipt to review.
   */
  private getUncategorizedCount(
    workspaceId: string,
    window: DashboardWindow | null = null,
  ): Promise<number> {
    return this.withinWindow(
      uncategorizedRowsQuery(this.transactionRepo, workspaceId),
      QUEUE_DATE_COLUMN.row,
      window,
    ).getCount();
  }

  /**
   * Limits a find-options column to `window`, spread into `where`; no condition
   * without one (TypeORM 1 refuses an `undefined` value in `where`).
   */
  private inWindow<K extends string>(
    column: K,
    window: DashboardWindow | null,
  ): Partial<Record<K, FindOperator<Date>>> {
    return window
      ? ({ [column]: Between(window.since, window.endDate) } as Record<K, FindOperator<Date>>)
      : {};
  }

  /** Limits a query to `window` on `column`; a `null` window leaves it untouched (live totals). */
  private withinWindow<Q extends { andWhere: (sql: string, params?: object) => unknown }>(
    query: Q,
    column: string,
    window: DashboardWindow | null,
  ): Q {
    if (window) {
      query.andWhere(`${column} BETWEEN :windowSince AND :windowEnd`, {
        windowSince: window.since,
        windowEnd: window.endDate,
      });
    }
    return query;
  }

  private createParsingWarningsQuery(workspaceId: string): SelectQueryBuilder<Statement> {
    return this.statementRepo
      .createQueryBuilder('s')
      .where('s.workspaceId = :workspaceId', { workspaceId })
      .andWhere('s.deletedAt IS NULL')
      .andWhere("jsonb_array_length(COALESCE(s.parsing_details->'warnings', '[]'::jsonb)) > 0");
  }

  async getTrends(
    workspaceId: string,
    days = 30,
    month?: string,
    viewerMemberId: string | null = null,
  ): Promise<DashboardTrendsResponse> {
    const monthWindow = parseMonthWindow(month);
    if (monthWindow) {
      return this.getMonthTrends(workspaceId, monthWindow, viewerMemberId);
    }

    const requestedWindow = getWindowBounds(days, new Date());
    let effectiveWindow = requestedWindow;
    let trendData = await this.getTrendData(
      workspaceId,
      requestedWindow.since,
      requestedWindow.endDate,
      days,
      viewerMemberId,
    );
    let autoShifted = false;

    if (trendData.daily.size === 0) {
      const latestTransactionDate = await this.getLatestTransactionDate(workspaceId);

      if (latestTransactionDate) {
        effectiveWindow = getWindowBounds(days, latestTransactionDate);
        trendData = await this.getTrendData(
          workspaceId,
          effectiveWindow.since,
          effectiveWindow.endDate,
          days,
          viewerMemberId,
        );
        autoShifted = true;
      }
    }

    const dailyTrend = this.toDailyTrend(trendData, effectiveWindow, days);
    const forecast = await this.computeForecast(workspaceId, dailyTrend, effectiveWindow, days);
    const response = this.buildTrendsResponse(trendData, dailyTrend, forecast);

    if (autoShifted) {
      response.effectiveEndDate = this.formatDateOnly(effectiveWindow.endDate);
      response.effectiveSince = this.formatDateOnly(effectiveWindow.since);
    }

    return response;
  }

  /**
   * Trends for one calendar month, picked on the dashboard. Never auto-shifts: an empty month is
   * shown as empty. The current month stops at today and gets a forecast; past months do not.
   */
  private async getMonthTrends(
    workspaceId: string,
    month: DashboardWindow,
    viewerMemberId: string | null,
  ): Promise<DashboardTrendsResponse> {
    const now = new Date();
    const isCurrentMonth = month.since <= now && now <= month.endDate;
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const window = isCurrentMonth ? { since: month.since, endDate: endOfToday } : month;
    const days = daysInMonth(month.since);

    const trendData = await this.getTrendData(
      workspaceId,
      window.since,
      window.endDate,
      days,
      viewerMemberId,
    );
    const dailyTrend = this.toDailyTrend(trendData, window, days);
    const forecast = isCurrentMonth
      ? await this.computeForecast(workspaceId, dailyTrend, window, days)
      : [];
    return this.buildTrendsResponse(trendData, dailyTrend, forecast);
  }

  private toDailyTrend(
    trendData: TrendRows,
    window: DashboardWindow,
    days: number,
  ): DashboardTrendsResponse['dailyTrend'] {
    return this.fillCashFlowWindow(
      new Map(
        [...trendData.daily.values()].map(point => [
          point.date,
          { date: point.date, income: round2(point.income), expense: round2(point.expense) },
        ]),
      ),
      window.since,
      window.endDate,
      days,
    );
  }

  private buildTrendsResponse(
    trendData: TrendRows,
    dailyTrend: DashboardTrendsResponse['dailyTrend'],
    forecast: DashboardTrendsResponse['forecast'],
  ): DashboardTrendsResponse {
    return {
      dailyTrend,
      forecast,
      categories: trendData.categories.map(row => ({ ...row, amount: round2(row.amount) })),
      counterparties: trendData.counterparties.map(row => ({
        ...row,
        amount: round2(row.amount),
      })),
      sources: {
        statements: {
          income: round2(trendData.totals.income),
          expense: round2(trendData.totals.expense),
          rows: trendData.totals.rows,
        },
      },
    };
  }

  /**
   * Forward-looking cash runway built from commitments the workspace has already
   * recorded — unpaid payables and active subscriptions — rather than from
   * extrapolated history like {@link computeForecast}. Answers "what is left on
   * the 15th" instead of "what does the trend suggest".
   */
  async getCommitments(workspaceId: string, days = 60): Promise<DashboardCommitmentsResponse> {
    const horizonDays = Math.min(Math.max(Math.trunc(days) || 0, 1), MAX_COMMITMENT_HORIZON_DAYS);
    const currency = await this.getWorkspaceCurrency(workspaceId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizonEnd = new Date(today);
    horizonEnd.setDate(horizonEnd.getDate() + horizonDays - 1);

    const [openingBalance, payables, subscriptions] = await Promise.all([
      this.getAllTimeBalance(workspaceId, currency),
      this.payableRepo.find({
        where: {
          workspaceId,
          direction: PayableDirection.PAYABLE,
          status: In([
            PayableStatus.TO_PAY,
            PayableStatus.SCHEDULED,
            PayableStatus.OVERDUE,
            PayableStatus.PARTIALLY_PAID,
          ]),
          deletedAt: IsNull(),
        },
      }),
      this.subscriptionRepo.find({
        where: { workspaceId, status: SubscriptionStatus.ACTIVE },
      }),
    ]);

    const [payableItems, subscriptionItems] = await Promise.all([
      this.collectPayableCommitments(payables, currency, today, horizonEnd),
      this.collectSubscriptionCommitments(subscriptions, currency, today, horizonEnd),
    ]);

    const items = [...payableItems.items, ...subscriptionItems].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    const runway = this.buildRunway(items, openingBalance, today, horizonDays);

    return {
      currency,
      horizonDays,
      openingBalance,
      unscheduledCommitted: payableItems.unscheduledCommitted,
      items,
      ...runway,
    };
  }

  /** Unpaid payables placed on their due date, with undated ones split out. */
  private async collectPayableCommitments(
    payables: Payable[],
    currency: string,
    today: Date,
    horizonEnd: Date,
  ): Promise<{ items: DashboardCommitmentItem[]; unscheduledCommitted: number }> {
    const items: DashboardCommitmentItem[] = [];
    let unscheduledCommitted = 0;

    for (const payable of payables) {
      // A partly paid bill is still owed, but only what is left of it.
      const amount = await this.convertDashboardAmount(
        Number(payable.amount) - Number(payable.paidAmount ?? 0),
        payable.currency,
        currency,
        payable.workspaceId,
      );
      if (amount <= 0) {
        continue;
      }
      const dueDate = this.parseDateOnly(payable.dueDate);
      if (!dueDate) {
        // Owed, but there is no day to place it on — reported separately.
        unscheduledCommitted += amount;
        continue;
      }
      if (dueDate > horizonEnd) {
        continue;
      }
      // Anything already past due is still owed today, so it lands on day zero.
      const isOverdue = dueDate < today;
      items.push({
        date: this.formatDateOnly(isOverdue ? today : dueDate),
        label: payable.vendor,
        amount,
        source: 'payable',
        sourceId: payable.id,
        isOverdue,
      });
    }

    return { items, unscheduledCommitted };
  }

  /** Every charge each active subscription will raise inside the horizon. */
  private async collectSubscriptionCommitments(
    subscriptions: Subscription[],
    currency: string,
    today: Date,
    horizonEnd: Date,
  ): Promise<DashboardCommitmentItem[]> {
    const items: DashboardCommitmentItem[] = [];

    for (const subscription of subscriptions) {
      const amount = await this.convertDashboardAmount(
        subscription.amount,
        subscription.currency,
        currency,
        subscription.workspaceId,
      );
      if (amount === 0) {
        continue;
      }
      for (const chargeDate of this.projectSubscriptionCharges(subscription, today, horizonEnd)) {
        items.push({
          date: this.formatDateOnly(chargeDate),
          label: subscription.vendorName,
          amount,
          source: 'subscription',
          sourceId: subscription.id,
          isOverdue: false,
        });
      }
    }

    return items;
  }

  /** Walks the horizon day by day, draining the opening balance as commitments fall due. */
  private buildRunway(
    items: DashboardCommitmentItem[],
    openingBalance: number,
    today: Date,
    horizonDays: number,
  ): Pick<
    DashboardCommitmentsResponse,
    'days' | 'totalCommitted' | 'lowestBalance' | 'lowestBalanceDate' | 'shortfallDate'
  > {
    const outflowByDate = new Map<string, number>();
    for (const item of items) {
      outflowByDate.set(item.date, (outflowByDate.get(item.date) ?? 0) + item.amount);
    }

    const days: DashboardCommitmentDay[] = [];
    let balance = openingBalance;
    let totalCommitted = 0;
    let lowestBalance = openingBalance;
    let lowestBalanceDate = this.formatDateOnly(today);
    let shortfallDate: string | null = null;

    for (let offset = 0; offset < horizonDays; offset += 1) {
      const cursor = new Date(today);
      cursor.setDate(cursor.getDate() + offset);
      const date = this.formatDateOnly(cursor);
      const outflow = outflowByDate.get(date) ?? 0;

      totalCommitted += outflow;
      balance -= outflow;

      if (balance < lowestBalance) {
        lowestBalance = balance;
        lowestBalanceDate = date;
      }
      if (shortfallDate === null && balance < 0) {
        shortfallDate = date;
      }

      days.push({ date, outflow, balance });
    }

    return { days, totalCommitted, lowestBalance, lowestBalanceDate, shortfallDate };
  }

  /** Every charge date of `subscription` that falls inside [today, horizonEnd]. */
  private projectSubscriptionCharges(
    subscription: Subscription,
    today: Date,
    horizonEnd: Date,
  ): Date[] {
    let cursor = this.parseDateOnly(subscription.nextChargeDate);
    if (!cursor) {
      return [];
    }

    // A next-charge date left in the past means the charge was never reconciled;
    // roll it forward so the projection starts from the next real occurrence.
    let guard = 0;
    while (cursor < today && guard < MAX_COMMITMENT_HORIZON_DAYS) {
      cursor = this.advanceByFrequency(cursor, subscription.frequency);
      guard += 1;
    }

    const charges: Date[] = [];
    while (cursor <= horizonEnd && charges.length < MAX_COMMITMENT_HORIZON_DAYS) {
      charges.push(new Date(cursor));
      cursor = this.advanceByFrequency(cursor, subscription.frequency);
    }
    return charges;
  }

  private advanceByFrequency(date: Date, frequency: SubscriptionFrequency): Date {
    switch (frequency) {
      case SubscriptionFrequency.WEEKLY: {
        const next = new Date(date);
        next.setDate(next.getDate() + 7);
        return next;
      }
      case SubscriptionFrequency.QUARTERLY:
        return this.addMonths(date, 3);
      case SubscriptionFrequency.ANNUAL:
        return this.addMonths(date, 12);
      default:
        return this.addMonths(date, 1);
    }
  }

  /** Month arithmetic that clamps to the last day instead of overflowing (Jan 31 + 1m = Feb 28). */
  private addMonths(date: Date, months: number): Date {
    const dayOfMonth = date.getDate();
    const result = new Date(date.getFullYear(), date.getMonth() + months, 1);
    result.setDate(Math.min(dayOfMonth, daysInMonth(result)));
    return result;
  }

  /** Postgres `date` columns arrive as 'YYYY-MM-DD' strings; parse them in local time. */
  private parseDateOnly(value: Date | string | null): Date | null {
    if (!value) {
      return null;
    }
    if (value instanceof Date) {
      const copy = new Date(value);
      copy.setHours(0, 0, 0, 0);
      return Number.isNaN(copy.getTime()) ? null : copy;
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
    if (!match) {
      return null;
    }
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  private async getLatestTransactionDate(workspaceId: string): Promise<Date | null> {
    const query = this.transactionRepo.createQueryBuilder('t').leftJoin('t.statement', 's');
    this.applyWorkspaceStatementFilters(query, workspaceId, true);

    const result = await query
      .select('MAX(t.transactionDate)', 'latestTransactionDate')
      .getRawOne<{ latestTransactionDate: Date | string | null }>();

    return result?.latestTransactionDate ? new Date(result.latestTransactionDate) : null;
  }

  private async getEarliestTransactionDate(workspaceId: string): Promise<Date | null> {
    const query = this.transactionRepo.createQueryBuilder('t').leftJoin('t.statement', 's');
    this.applyWorkspaceStatementFilters(query, workspaceId, true);

    const result = await query
      .select('MIN(t.transactionDate)', 'earliestTransactionDate')
      .getRawOne<{ earliestTransactionDate: Date | string | null }>();

    return result?.earliestTransactionDate ? new Date(result.earliestTransactionDate) : null;
  }

  private formatDateOnly(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * A period's trends (MCP `get_trends`, the assistant). Rows are summed per currency and
   * converted into the workspace currency before they are added up, as the cash
   * flow chart does: a sale in shekels must not count as that many dollars.
   */
  private async getTrendData(
    workspaceId: string,
    since: Date,
    endDate: Date,
    days: number,
    viewerMemberId: string | null,
  ): Promise<TrendRows> {
    const currency = await this.getWorkspaceCurrency(workspaceId);
    const convert = (amount: string, from: string) =>
      this.convertDashboardAmount(amount, from, currency, workspaceId);
    // Another member's private income counts under the placeholder, not its payer.
    const incomeSource = redactedSql('t', 't.counterparty_name');

    const [daily, categoryRows, counterpartyRows, countRow] = await Promise.all([
      this.sumCashFlowByBucket(
        workspaceId,
        since,
        endDate,
        this.getTransactionGroupFormat(days),
        currency,
      ),
      this.createTrendBaseQuery(workspaceId, since, endDate)
        .leftJoin('t.category', 'c')
        .select("COALESCE(c.name, 'Uncategorized')", 'name')
        // Grouped by name: same-named categories share one row, and one of their looks.
        .addSelect('MAX(c.color)', 'color')
        .addSelect('MAX(c.icon)', 'icon')
        .addSelect('t.currency', 'currency')
        .addSelect('COALESCE(SUM(t.debit), 0)', 'amount')
        .addSelect('COUNT(t.id)', 'count')
        .andWhere('t.transactionType = :expense', { expense: TransactionType.EXPENSE })
        .groupBy('c.name')
        .addGroupBy('t.currency')
        .getRawMany<{
          name: string;
          color: string | null;
          icon: string | null;
          currency: string;
          amount: string;
          count: string;
        }>(),
      this.createTrendBaseQuery(workspaceId, since, endDate)
        .select(incomeSource, 'name')
        .addSelect('t.currency', 'currency')
        .addSelect('COALESCE(SUM(t.credit), 0)', 'amount')
        .addSelect('COUNT(t.id)', 'count')
        .andWhere('t.transactionType = :income', { income: TransactionType.INCOME })
        .andWhere('t.counterpartyName IS NOT NULL')
        .andWhere("t.counterpartyName != ''")
        .groupBy(incomeSource)
        .addGroupBy('t.currency')
        .setParameter(PRIVACY_VIEWER_PARAM, viewerMemberId)
        .getRawMany<{ name: string; currency: string; amount: string; count: string }>(),
      this.createTrendBaseQuery(workspaceId, since, endDate)
        .select('COUNT(DISTINCT t.id)', 'rows')
        .getRawOne<{ rows: string }>(),
    ]);

    /** Adds each name's rows across currencies, largest first. */
    const mergeByName = async <
      Row extends { name: string; currency: string; amount: string; count: string },
    >(
      rows: Row[],
    ) => {
      const merged = new Map<
        string,
        Omit<Row, 'currency' | 'amount' | 'count'> & { amount: number; count: number }
      >();
      for (const { currency: from, amount, count, ...rest } of rows) {
        const entry = merged.get(rest.name) ?? { ...rest, amount: 0, count: 0 };
        entry.amount += await convert(amount, from);
        entry.count += Number.parseInt(count, 10) || 0;
        merged.set(rest.name, entry);
      }
      return [...merged.values()]
        .sort((left, right) => right.amount - left.amount)
        .slice(0, TREND_LIST_LIMIT);
    };

    const points = [...daily.values()];
    return {
      daily,
      categories: (await mergeByName(categoryRows)).map(row => ({
        name: row.name,
        color: row.color ?? null,
        icon: row.icon ?? null,
        amount: row.amount,
        count: row.count,
      })),
      counterparties: await mergeByName(counterpartyRows),
      totals: {
        income: points.reduce((sum, point) => sum + point.income, 0),
        expense: points.reduce((sum, point) => sum + point.expense, 0),
        rows: Number.parseInt(countRow?.rows ?? '0', 10) || 0,
      },
    };
  }

  private createTrendBaseQuery(workspaceId: string, since: Date, endDate: Date) {
    const query = this.transactionRepo.createQueryBuilder('t').leftJoin('t.statement', 's');
    this.applyActiveStatementTransactionFilters(query, workspaceId, since, endDate);
    return query;
  }

  private getTransactionGroupFormat(days: number): string {
    return days >= 90 ? "'IYYY-IW'" : "'YYYY-MM-DD'";
  }

  private fillCashFlowWindow(
    points: Map<string, DashboardCashFlowPoint>,
    since: Date,
    endDate: Date,
    days: number,
  ): DashboardCashFlowPoint[] {
    if (points.size === 0) {
      return [];
    }

    const buckets =
      days >= 90 ? this.buildWeeklyBuckets(since, endDate) : this.buildDailyBuckets(since, endDate);
    return buckets.map(date => points.get(date) ?? { date, income: 0, expense: 0 });
  }

  private buildDailyBuckets(since: Date, endDate: Date): string[] {
    const buckets: string[] = [];
    const cursor = new Date(since);
    cursor.setHours(0, 0, 0, 0);

    const last = new Date(endDate);
    last.setHours(0, 0, 0, 0);

    while (cursor <= last) {
      buckets.push(this.formatDateOnly(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    return buckets;
  }

  private buildMonthlyBuckets(since: Date, endDate: Date): string[] {
    const buckets: string[] = [];
    const cursor = new Date(since.getFullYear(), since.getMonth(), 1);

    while (cursor <= endDate) {
      buckets.push(this.formatDateOnly(cursor).slice(0, 7));
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return buckets;
  }

  private buildWeeklyBuckets(since: Date, endDate: Date): string[] {
    const buckets: string[] = [];
    const cursor = this.startOfIsoWeek(since);
    const last = new Date(endDate);

    while (cursor <= last) {
      buckets.push(this.isoYearWeek(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }

    return buckets;
  }

  private startOfIsoWeek(date: Date): Date {
    const cursor = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = cursor.getUTCDay() || 7;
    cursor.setUTCDate(cursor.getUTCDate() - day + 1);
    return cursor;
  }

  private applyActiveStatementTransactionFilters(
    query: SelectQueryBuilder<Transaction>,
    workspaceId: string,
    since: Date,
    endDate: Date,
    options: { confirmedOnly?: boolean } = {},
  ) {
    this.applyWorkspaceStatementFilters(query, workspaceId, true, options);
    query.andWhere('t.transactionDate BETWEEN :since AND :endDate', { since, endDate });
  }

  private applyWorkspaceStatementFilters(
    query: SelectQueryBuilder<Transaction>,
    workspaceId: string,
    excludeDuplicates: boolean,
    { confirmedOnly = true }: { confirmedOnly?: boolean } = {},
  ) {
    // On the row itself: a row without a statement has no statement to carry the workspace.
    query.where('t.workspaceId = :workspaceId', { workspaceId });
    // Only what the user confirmed counts in any figure; data-health counts opt out.
    onlyFlows(query, 't', { includeUnconfirmed: !confirmedOnly });
    if (excludeDuplicates) {
      query.andWhere('t.isDuplicate = false');
      query.andWhere('t.transferPairId IS NULL');
    }
  }

  // --- Forecast ---

  private async computeForecast(
    workspaceId: string,
    currentTrend: Array<{ date: string; income: number; expense: number }>,
    currentWindow: { since: Date; endDate: Date },
    days: number,
  ): Promise<Array<{ date: string; income: number; expense: number }>> {
    const isWeekly = days >= 90;
    const forecastCount = days <= 7 ? 3 : days <= 30 ? 7 : 2;
    const historyMultiplier = days <= 7 ? 4 : days <= 30 ? 3 : 2;

    const extendedSince = new Date(currentWindow.since);
    extendedSince.setDate(extendedSince.getDate() - days * historyMultiplier);

    // In the workspace currency, as the days it continues.
    const history = [
      ...(
        await this.sumCashFlowByBucket(
          workspaceId,
          extendedSince,
          currentWindow.endDate,
          "'YYYY-MM-DD'",
          await this.getWorkspaceCurrency(workspaceId),
        )
      ).values(),
    ];

    if (history.length < 3) {
      return [];
    }

    if (isWeekly) {
      return this.forecastWeekly(history, currentTrend, forecastCount);
    }
    return this.forecastDaily(history, currentTrend, forecastCount);
  }

  private forecastDaily(
    history: Array<{ date: string; income: number; expense: number }>,
    currentTrend: Array<{ date: string; income: number; expense: number }>,
    forecastDays: number,
  ): Array<{ date: string; income: number; expense: number }> {
    const windowSize = Math.min(7, history.length);
    const recent = history.slice(-windowSize);

    const wmaIncome = this.weightedMovingAverage(recent.map(d => d.income));
    const wmaExpense = this.weightedMovingAverage(recent.map(d => d.expense));

    const dowFactors = this.computeDayOfWeekFactors(history);

    const lastDateStr =
      currentTrend.length > 0
        ? currentTrend[currentTrend.length - 1].date
        : history[history.length - 1].date;
    const lastDate = new Date(lastDateStr);

    const forecast: Array<{ date: string; income: number; expense: number }> = [];
    for (let i = 1; i <= forecastDays; i++) {
      const d = new Date(lastDate);
      d.setDate(d.getDate() + i);
      const dow = d.getDay();
      const factor = dowFactors[dow];
      forecast.push({
        date: this.formatDateOnly(d),
        income: Math.max(0, Math.round(wmaIncome * factor * 100) / 100),
        expense: Math.max(0, Math.round(wmaExpense * factor * 100) / 100),
      });
    }
    return forecast;
  }

  private forecastWeekly(
    dailyHistory: Array<{ date: string; income: number; expense: number }>,
    currentTrend: Array<{ date: string; income: number; expense: number }>,
    forecastWeeks: number,
  ): Array<{ date: string; income: number; expense: number }> {
    const weeklyMap = new Map<string, { income: number; expense: number }>();
    for (const d of dailyHistory) {
      const dt = new Date(d.date);
      const weekKey = this.isoYearWeek(dt);
      const existing = weeklyMap.get(weekKey) ?? { income: 0, expense: 0 };
      existing.income += d.income;
      existing.expense += d.expense;
      weeklyMap.set(weekKey, existing);
    }

    const weeklyData = Array.from(weeklyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);

    if (weeklyData.length < 2) {
      return [];
    }

    const windowSize = Math.min(4, weeklyData.length);
    const recent = weeklyData.slice(-windowSize);
    const wmaIncome = this.weightedMovingAverage(recent.map(w => w.income));
    const wmaExpense = this.weightedMovingAverage(recent.map(w => w.expense));

    const lastWeekStr =
      currentTrend.length > 0
        ? currentTrend[currentTrend.length - 1].date
        : (Array.from(weeklyMap.keys()).sort().pop() ?? this.isoYearWeek(new Date()));
    const [yearStr, weekStr] = lastWeekStr.split('-');
    let year = Number.parseInt(yearStr, 10);
    let week = Number.parseInt(weekStr, 10);

    const forecast: Array<{ date: string; income: number; expense: number }> = [];
    for (let i = 0; i < forecastWeeks; i++) {
      week++;
      if (week > 52) {
        week = 1;
        year++;
      }
      forecast.push({
        date: `${year}-${String(week).padStart(2, '0')}`,
        income: Math.max(0, Math.round(wmaIncome * 100) / 100),
        expense: Math.max(0, Math.round(wmaExpense * 100) / 100),
      });
    }
    return forecast;
  }

  private weightedMovingAverage(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }
    let weightedSum = 0;
    let totalWeight = 0;
    for (let i = 0; i < values.length; i++) {
      const weight = i + 1;
      weightedSum += values[i] * weight;
      totalWeight += weight;
    }
    return weightedSum / totalWeight;
  }

  private computeDayOfWeekFactors(
    history: Array<{ date: string; income: number; expense: number }>,
  ): Record<number, number> {
    const dowSums: Record<number, { total: number; count: number }> = {};
    for (let i = 0; i < 7; i++) {
      dowSums[i] = { total: 0, count: 0 };
    }

    let overallTotal = 0;
    for (const d of history) {
      const dow = new Date(d.date).getDay();
      const combined = d.income + d.expense;
      dowSums[dow].total += combined;
      dowSums[dow].count++;
      overallTotal += combined;
    }

    const overallAvg = overallTotal / history.length;
    if (overallAvg === 0) {
      const result: Record<number, number> = {};
      for (let i = 0; i < 7; i++) {
        result[i] = 1;
      }
      return result;
    }

    const factors: Record<number, number> = {};
    for (let i = 0; i < 7; i++) {
      const dayAvg = dowSums[i].count > 0 ? dowSums[i].total / dowSums[i].count : overallAvg;
      factors[i] = dayAvg / overallAvg;
    }
    return factors;
  }

  private isoYearWeek(date: Date): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-${String(weekNo).padStart(2, '0')}`;
  }
}
