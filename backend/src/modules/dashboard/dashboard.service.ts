import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  type FindOperator,
  In,
  IsNull,
  type ObjectLiteral,
  type Repository,
  type SelectQueryBuilder,
} from 'typeorm';
import { countedSql, onlyCounted } from '../../common/utils/counted-transactions.util';
import { currencyCodeOrDefault } from '../../common/utils/currency.util';
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
  type CashFlowRange,
  type DashboardWindow,
  daysInMonth,
  getCashFlowRangeBounds,
  getMonthWindowBounds,
  getWindowBounds,
  getYearWindowBounds,
  parseMonthWindow,
} from './dashboard-window.util';
import type {
  DashboardCommitmentDay,
  DashboardCommitmentItem,
  DashboardCommitmentsResponse,
} from './interfaces/dashboard-commitments.interface';
import type {
  DashboardActionItem,
  DashboardCashFlowPoint,
  DashboardDataHealth,
  DashboardFinancialSnapshot,
  DashboardHealthHistoryResponse,
  DashboardHealthMonth,
  DashboardMonthlyCashFlowResponse,
  DashboardRecentTransaction,
  DashboardResponse,
  DashboardTopCategory,
  DashboardTopMerchant,
} from './interfaces/dashboard-response.interface';
import type { DashboardTrendsResponse } from './interfaces/dashboard-trends.interface';

/** How many individual categories the donut shows before folding the rest into "Other". */
const TOP_CATEGORIES_LIMIT = 8;
/** Neutral swatch for categories with no color set and for the "Other" bucket. */
const OTHER_CATEGORY_COLOR = '#898781';
/** Internal grouping key for transactions with no category — never sent to the client. */
const UNCATEGORIZED_KEY = '__uncategorized__';
/** Which history counter a statement in each queue status feeds. */
const STATEMENT_STATUS_METRIC: Partial<
  Record<string, 'statementErrors' | 'statementsPendingReview' | 'statementsPendingSubmit'>
> = {
  [StatementStatus.ERROR]: 'statementErrors',
  [StatementStatus.PARSED]: 'statementsPendingReview',
  [StatementStatus.VALIDATED]: 'statementsPendingReview',
  [StatementStatus.UPLOADED]: 'statementsPendingSubmit',
};

interface TrendRows {
  dailyRows: Array<{ date: string; income: string; expense: string }>;
  categoryRows: Array<{ name: string; amount: string; count: string }>;
  counterpartyRows: Array<{ name: string; amount: string; count: string }>;
  sourceRows: { income: string; expense: string; rows: string } | undefined;
}

/** How many rows the dashboard's recent-transactions card shows. */
const RECENT_TRANSACTIONS_LIMIT = 6;
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

    // The month dashboard counts its queues (Finance Ops, Data Health) for that month too;
    // the rolling 7d/30d/90d ranges keep the live, all-time queue totals.
    const queueWindow = isMonth ? effectiveWindow : null;

    const [cashFlow, topMerchants, topCategories, recentTransactions, actions, dataHealth] =
      await Promise.all([
        this.getCashFlow(workspaceId, effectiveWindow.since, effectiveWindow.endDate, bucketDays),
        this.getTopMerchants(workspaceId, effectiveWindow.since, effectiveWindow.endDate),
        this.getTopCategories(workspaceId, effectiveWindow.since, effectiveWindow.endDate),
        this.getRecentTransactions(workspaceId, effectiveWindow.since, effectiveWindow.endDate),
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
      select: ['currency'],
    });
    const targetCurrency = this.normalizeCurrency(workspace?.currency);

    // Group income/expense by currency so we can convert each group
    const txRows = await this.transactionRepo
      .createQueryBuilder('t')
      .innerJoin('t.statement', 's')
      .select([
        't.currency AS currency',
        // Income and expense count confirmed rows only; unapproved cash below is
        // what still waits, so it keeps the unconfirmed ones on purpose.
        `COALESCE(SUM(CASE WHEN t.transactionType = :income AND ${countedSql('t')} THEN t.credit ELSE 0 END), 0) AS income`,
        `COALESCE(SUM(CASE WHEN t.transactionType = :expense AND ${countedSql('t')} THEN t.debit ELSE 0 END), 0) AS expense`,
        'COALESCE(SUM(CASE WHEN s.status IN (:...unapprovedStatuses) THEN (CASE WHEN t.transactionType = :income THEN t.credit ELSE -t.debit END) ELSE 0 END), 0) AS "unapprovedCash"',
      ])
      .where('s.workspaceId = :workspaceId', { workspaceId })
      .andWhere('t.transactionDate BETWEEN :since AND :endDate', { since, endDate })
      .andWhere('s.deletedAt IS NULL')
      .andWhere('t.isDuplicate = false')
      .andWhere('t.transferPairId IS NULL')
      .andWhere('s.status NOT IN (:...excludedStatuses)', {
        excludedStatuses: [StatementStatus.ERROR, StatementStatus.PROCESSING],
      })
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
    const balanceQuery = this.transactionRepo.createQueryBuilder('t').innerJoin('t.statement', 's');
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
      select: ['currency'],
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
        createdAt: this.between(window),
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
        createdAt: this.between(window),
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
        dueDate: this.between(window),
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
        receivedAt: this.between(window),
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

  /** Income/expense per `TO_CHAR` bucket, every currency converted into `targetCurrency`. */
  private async sumCashFlowByBucket(
    workspaceId: string,
    since: Date,
    endDate: Date,
    groupFormat: string,
    targetCurrency: string,
  ): Promise<Map<string, DashboardCashFlowPoint>> {
    const query = this.transactionRepo.createQueryBuilder('t').innerJoin('t.statement', 's');

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
  ): Promise<DashboardTopMerchant[]> {
    const targetCurrency = await this.getWorkspaceCurrency(workspaceId);
    const query = this.transactionRepo.createQueryBuilder('t').innerJoin('t.statement', 's');

    this.applyActiveStatementTransactionFilters(query, workspaceId, since, endDate);

    const result = await query
      .select('t.counterpartyName', 'name')
      .addSelect('t.currency', 'currency')
      .addSelect('COALESCE(SUM(t.debit), 0)', 'amount')
      .addSelect('COUNT(t.id)', 'count')
      .andWhere('t.transactionType = :expense', { expense: TransactionType.EXPENSE })
      .andWhere('t.counterpartyName IS NOT NULL')
      .andWhere("t.counterpartyName != ''")
      .groupBy('t.counterpartyName')
      .addGroupBy('t.currency')
      .orderBy('amount', 'DESC')
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
      .innerJoin('t.statement', 's')
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
  ): Promise<DashboardRecentTransaction[]> {
    const targetCurrency = await this.getWorkspaceCurrency(workspaceId);
    const query = this.transactionRepo
      .createQueryBuilder('t')
      .innerJoin('t.statement', 's')
      .leftJoin('t.category', 'c');

    this.applyActiveStatementTransactionFilters(query, workspaceId, since, endDate);

    const rows = await query
      .select('t.id', 'id')
      .addSelect('t.counterpartyName', 'description')
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
      .orderBy('t.transactionDate', 'DESC')
      .addOrderBy('t.createdAt', 'DESC')
      .limit(RECENT_TRANSACTIONS_LIMIT)
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
      }>();

    return Promise.all(
      rows.map(async row => {
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
      select: ['role'],
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
      unapprovedCashResult,
    ] = await Promise.all([
      this.getUncategorizedCount(workspaceId, window),
      // statements with errors
      this.statementRepo.count({
        where: {
          workspaceId,
          status: StatementStatus.ERROR,
          deletedAt: IsNull(),
          createdAt: this.between(window),
        },
      }),
      // statements pending review: parsed or validated
      this.statementRepo.count({
        where: {
          workspaceId,
          status: In([StatementStatus.PARSED, StatementStatus.VALIDATED]),
          deletedAt: IsNull(),
          createdAt: this.between(window),
        },
      }),
      // statements pending submit: uploaded but not submitted yet
      this.statementRepo.count({
        where: {
          workspaceId,
          status: StatementStatus.UPLOADED,
          deletedAt: IsNull(),
          createdAt: this.between(window),
        },
      }),
      // receipts pending review
      this.receiptRepo.count({
        where: {
          workspaceId,
          status: In([ReceiptStatus.NEW, ReceiptStatus.NEEDS_REVIEW]),
          receivedAt: this.between(window),
        },
      }),
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
        select: ['createdAt'],
      }),
      // unapproved cash
      this.withinWindow(
        this.transactionRepo
          .createQueryBuilder('t')
          .innerJoin('t.statement', 's')
          .select(
            'COALESCE(SUM(CASE WHEN t.transactionType = :income THEN t.credit ELSE -t.debit END), 0)',
            'unapprovedCash',
          )
          .where('s.workspaceId = :workspaceId', { workspaceId })
          .andWhere('s.status IN (:...unapprovedStatuses)', {
            unapprovedStatuses: [
              StatementStatus.UPLOADED,
              StatementStatus.PARSED,
              StatementStatus.VALIDATED,
            ],
          })
          .andWhere('s.deletedAt IS NULL'),
        't.transactionDate',
        window,
      )
        .setParameter('income', TransactionType.INCOME)
        .getRawOne<{ unapprovedCash: string }>(),
    ]);

    return {
      uncategorizedTransactions,
      statementsWithErrors,
      statementsPendingReview,
      statementsPendingSubmit,
      receiptsPendingReview,
      unapprovedCash: Number.parseFloat(unapprovedCashResult?.unapprovedCash ?? '') || 0,
      lastUploadDate: latestStatement?.createdAt?.toISOString() ?? null,
      parsingWarnings,
    };
  }

  private async getUncategorizedCount(
    workspaceId: string,
    window: DashboardWindow | null = null,
  ): Promise<number> {
    const [transactionCount, receiptCount] = await Promise.all([
      this.getUncategorizedTransactionCount(workspaceId, window),
      this.withinWindow(
        this.createUncategorizedReceiptQuery(workspaceId),
        'r.receivedAt',
        window,
      ).getCount(),
    ]);

    return transactionCount + receiptCount;
  }

  private async getUncategorizedTransactionCount(
    workspaceId: string,
    window: DashboardWindow | null,
  ): Promise<number> {
    const query = this.transactionRepo.createQueryBuilder('t').innerJoin('t.statement', 's');

    // A "needs attention" count: unconfirmed rows are exactly the ones to fix.
    this.applyWorkspaceStatementFilters(query, workspaceId, true, { confirmedOnly: false });
    query.andWhere('t.categoryId IS NULL');

    return this.withinWindow(query, 't.transactionDate', window).getCount();
  }

  /** Limits a find-options column to `window`; `undefined` (no condition) without one. */
  private between(window: DashboardWindow | null): FindOperator<Date> | undefined {
    return window ? Between(window.since, window.endDate) : undefined;
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

  private createUncategorizedReceiptQuery(workspaceId: string): SelectQueryBuilder<Receipt> {
    return this.receiptRepo
      .createQueryBuilder('r')
      .leftJoin('r.transaction', 'rt')
      .where('r.workspaceId = :workspaceId', { workspaceId })
      .andWhere('r.isDuplicate = false')
      .andWhere('r.status != :failedStatus', { failedStatus: ReceiptStatus.FAILED })
      .andWhere("NULLIF(TRIM(r.parsed_data->>'amount'), '') IS NOT NULL")
      .andWhere("NULLIF(r.parsed_data ->> 'categoryId', '') IS NULL")
      .andWhere('rt.category_id IS NULL');
  }

  /**
   * Per-month history of the queues shown on Data Health and Finance Ops, for one calendar year.
   * Nothing is stored: each item is counted in the month it is dated by, so fixing old data
   * changes old months too.
   */
  async getHealthHistory(
    workspaceId: string,
    year: number,
  ): Promise<DashboardHealthHistoryResponse> {
    const now = new Date();
    if (year > now.getFullYear()) {
      return { year, months: [] };
    }
    const window = getYearWindowBounds(year);
    const lastMonthIndex = year === now.getFullYear() ? now.getMonth() : 11;
    const months = new Map<string, DashboardHealthMonth>();
    for (let index = 0; index <= lastMonthIndex; index++) {
      const month = `${year}-${String(index + 1).padStart(2, '0')}`;
      months.set(month, {
        month,
        transactions: 0,
        uncategorized: 0,
        statementsUploaded: 0,
        statementErrors: 0,
        statementsPendingReview: 0,
        statementsPendingSubmit: 0,
        parsingWarnings: 0,
        receiptsPendingReview: 0,
        overduePayments: 0,
      });
    }

    const [
      transactionRows,
      uncategorizedReceiptRows,
      statementRows,
      warningRows,
      pendingReceiptRows,
      overdueRows,
    ] = await Promise.all([
      this.getTransactionHistoryRows(workspaceId, window),
      this.countByMonth(this.createUncategorizedReceiptQuery(workspaceId), 'r.receivedAt', window),
      this.getStatementStatusHistoryRows(workspaceId, window),
      this.countByMonth(this.createParsingWarningsQuery(workspaceId), 's.createdAt', window),
      this.countByMonth(
        this.receiptRepo
          .createQueryBuilder('r')
          .where('r.workspaceId = :workspaceId', { workspaceId })
          .andWhere('r.status IN (:...pendingStatuses)', {
            pendingStatuses: [ReceiptStatus.NEW, ReceiptStatus.NEEDS_REVIEW],
          }),
        'r.receivedAt',
        window,
      ),
      this.countByMonth(
        this.payableRepo
          .createQueryBuilder('p')
          .where('p.workspaceId = :workspaceId', { workspaceId })
          .andWhere('p.status = :overdue', { overdue: PayableStatus.OVERDUE })
          .andWhere('p.deletedAt IS NULL'),
        'p.dueDate',
        window,
      ),
    ]);

    const add = (
      month: string,
      key: Exclude<keyof DashboardHealthMonth, 'month'>,
      count: string,
    ): void => {
      const entry = months.get(month);
      if (entry) {
        entry[key] += Number.parseInt(count, 10) || 0;
      }
    };
    for (const row of transactionRows) {
      add(row.month, 'transactions', row.total);
      add(row.month, 'uncategorized', row.uncategorized);
    }
    for (const row of uncategorizedReceiptRows) {
      add(row.month, 'uncategorized', row.count);
    }
    for (const row of statementRows) {
      add(row.month, 'statementsUploaded', row.count);
      const metric = STATEMENT_STATUS_METRIC[row.status];
      if (metric) {
        add(row.month, metric, row.count);
      }
    }
    for (const row of warningRows) {
      add(row.month, 'parsingWarnings', row.count);
    }
    for (const row of pendingReceiptRows) {
      add(row.month, 'receiptsPendingReview', row.count);
    }
    for (const row of overdueRows) {
      add(row.month, 'overduePayments', row.count);
    }

    return { year, months: Array.from(months.values()) };
  }

  private getTransactionHistoryRows(
    workspaceId: string,
    window: DashboardWindow,
  ): Promise<Array<{ month: string; total: string; uncategorized: string }>> {
    const query = this.transactionRepo.createQueryBuilder('t').innerJoin('t.statement', 's');
    // Data health counts every row, confirmed or not: it shows what needs work.
    this.applyActiveStatementTransactionFilters(query, workspaceId, window.since, window.endDate, {
      confirmedOnly: false,
    });
    return query
      .select("TO_CHAR(t.transactionDate, 'YYYY-MM')", 'month')
      .addSelect('COUNT(t.id)', 'total')
      .addSelect('SUM(CASE WHEN t.categoryId IS NULL THEN 1 ELSE 0 END)', 'uncategorized')
      .groupBy("TO_CHAR(t.transactionDate, 'YYYY-MM')")
      .getRawMany<{ month: string; total: string; uncategorized: string }>();
  }

  private getStatementStatusHistoryRows(
    workspaceId: string,
    window: DashboardWindow,
  ): Promise<Array<{ month: string; status: string; count: string }>> {
    return this.withinWindow(
      this.statementRepo
        .createQueryBuilder('s')
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('s.deletedAt IS NULL'),
      's.createdAt',
      window,
    )
      .select("TO_CHAR(s.createdAt, 'YYYY-MM')", 'month')
      .addSelect('s.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy("TO_CHAR(s.createdAt, 'YYYY-MM')")
      .addGroupBy('s.status')
      .getRawMany<{ month: string; status: string; count: string }>();
  }

  /** Row count per `YYYY-MM` of `dateColumn`, inside `window`. */
  private countByMonth<T extends ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    dateColumn: string,
    window: DashboardWindow,
  ): Promise<Array<{ month: string; count: string }>> {
    return this.withinWindow(query, dateColumn, window)
      .select(`TO_CHAR(${dateColumn}, 'YYYY-MM')`, 'month')
      .addSelect('COUNT(*)', 'count')
      .groupBy(`TO_CHAR(${dateColumn}, 'YYYY-MM')`)
      .getRawMany<{ month: string; count: string }>();
  }

  async getTrends(
    workspaceId: string,
    days = 30,
    month?: string,
  ): Promise<DashboardTrendsResponse> {
    const monthWindow = parseMonthWindow(month);
    if (monthWindow) {
      return this.getMonthTrends(workspaceId, monthWindow);
    }

    const requestedWindow = getWindowBounds(days, new Date());
    let effectiveWindow = requestedWindow;
    let trendData = await this.getTrendData(
      workspaceId,
      requestedWindow.since,
      requestedWindow.endDate,
      days,
    );
    let autoShifted = false;

    if (trendData.dailyRows.length === 0) {
      const latestTransactionDate = await this.getLatestTransactionDate(workspaceId);

      if (latestTransactionDate) {
        effectiveWindow = getWindowBounds(days, latestTransactionDate);
        trendData = await this.getTrendData(
          workspaceId,
          effectiveWindow.since,
          effectiveWindow.endDate,
          days,
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
  ): Promise<DashboardTrendsResponse> {
    const now = new Date();
    const isCurrentMonth = month.since <= now && now <= month.endDate;
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const window = isCurrentMonth ? { since: month.since, endDate: endOfToday } : month;
    const days = daysInMonth(month.since);

    const trendData = await this.getTrendData(workspaceId, window.since, window.endDate, days);
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
        trendData.dailyRows.map(row => [
          row.date,
          {
            date: row.date,
            income: Number.parseFloat(row.income) || 0,
            expense: Number.parseFloat(row.expense) || 0,
          },
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
      categories: trendData.categoryRows.map(row => ({
        name: row.name,
        amount: Number.parseFloat(row.amount) || 0,
        count: Number.parseInt(row.count, 10) || 0,
      })),
      counterparties: trendData.counterpartyRows.map(row => ({
        name: row.name,
        amount: Number.parseFloat(row.amount) || 0,
        count: Number.parseInt(row.count, 10) || 0,
      })),
      sources: {
        statements: {
          income: Number.parseFloat(trendData.sourceRows?.income ?? '') || 0,
          expense: Number.parseFloat(trendData.sourceRows?.expense ?? '') || 0,
          rows: Number.parseInt(trendData.sourceRows?.rows ?? '0', 10) || 0,
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
    const query = this.transactionRepo.createQueryBuilder('t').innerJoin('t.statement', 's');
    this.applyWorkspaceStatementFilters(query, workspaceId, true);

    const result = await query
      .select('MAX(t.transactionDate)', 'latestTransactionDate')
      .getRawOne<{ latestTransactionDate: Date | string | null }>();

    return result?.latestTransactionDate ? new Date(result.latestTransactionDate) : null;
  }

  private async getEarliestTransactionDate(workspaceId: string): Promise<Date | null> {
    const query = this.transactionRepo.createQueryBuilder('t').innerJoin('t.statement', 's');
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

  private async getTrendData(workspaceId: string, since: Date, endDate: Date, days: number) {
    const groupFormat = this.getTransactionGroupFormat(days);

    const [dailyRows, categoryRows, counterpartyRows, sourceRows] = await Promise.all([
      this.createTrendBaseQuery(workspaceId, since, endDate)
        .select(`TO_CHAR(t.transactionDate, ${groupFormat})`, 'date')
        .addSelect(
          'COALESCE(SUM(CASE WHEN t.transactionType = :income THEN t.credit ELSE 0 END), 0)',
          'income',
        )
        .addSelect(
          'COALESCE(SUM(CASE WHEN t.transactionType = :expense THEN t.debit ELSE 0 END), 0)',
          'expense',
        )
        .groupBy(`TO_CHAR(t.transactionDate, ${groupFormat})`)
        .orderBy(`TO_CHAR(t.transactionDate, ${groupFormat})`, 'ASC')
        .setParameter('income', TransactionType.INCOME)
        .setParameter('expense', TransactionType.EXPENSE)
        .getRawMany<{ date: string; income: string; expense: string }>(),
      this.createTrendBaseQuery(workspaceId, since, endDate)
        .leftJoin('t.category', 'c')
        .select("COALESCE(c.name, 'Uncategorized')", 'name')
        .addSelect('COALESCE(SUM(t.debit), 0)', 'amount')
        .addSelect('COUNT(t.id)', 'count')
        .andWhere('t.transactionType = :expense', { expense: TransactionType.EXPENSE })
        .groupBy('c.name')
        .orderBy('amount', 'DESC')
        .limit(10)
        .getRawMany<{ name: string; amount: string; count: string }>(),
      this.createTrendBaseQuery(workspaceId, since, endDate)
        .select('t.counterpartyName', 'name')
        .addSelect('COALESCE(SUM(t.credit), 0)', 'amount')
        .addSelect('COUNT(t.id)', 'count')
        .andWhere('t.transactionType = :income', { income: TransactionType.INCOME })
        .andWhere('t.counterpartyName IS NOT NULL')
        .andWhere("t.counterpartyName != ''")
        .groupBy('t.counterpartyName')
        .orderBy('amount', 'DESC')
        .limit(10)
        .getRawMany<{ name: string; amount: string; count: string }>(),
      this.createTrendBaseQuery(workspaceId, since, endDate)
        .select(
          'COALESCE(SUM(CASE WHEN t.transactionType = :income THEN t.credit ELSE 0 END), 0)',
          'income',
        )
        .addSelect(
          'COALESCE(SUM(CASE WHEN t.transactionType = :expense THEN t.debit ELSE 0 END), 0)',
          'expense',
        )
        .addSelect('COUNT(DISTINCT t.id)', 'rows')
        .setParameter('income', TransactionType.INCOME)
        .setParameter('expense', TransactionType.EXPENSE)
        .getRawOne<{ income: string; expense: string; rows: string }>(),
    ]);

    return { dailyRows, categoryRows, counterpartyRows, sourceRows };
  }

  private createTrendBaseQuery(workspaceId: string, since: Date, endDate: Date) {
    const query = this.transactionRepo.createQueryBuilder('t').innerJoin('t.statement', 's');
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
    query.where('s.workspaceId = :workspaceId', { workspaceId });
    query.andWhere('s.deletedAt IS NULL');
    // Only what the user confirmed counts in any figure; data-health counts opt out.
    if (confirmedOnly) {
      onlyCounted(query, 't');
    }
    if (excludeDuplicates) {
      query.andWhere('t.isDuplicate = false');
      query.andWhere('t.transferPairId IS NULL');
    }
    query.andWhere('s.status NOT IN (:...excludedStatuses)', {
      excludedStatuses: [StatementStatus.ERROR, StatementStatus.PROCESSING],
    });
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

    const extendedRows = await this.createTrendBaseQuery(
      workspaceId,
      extendedSince,
      currentWindow.endDate,
    )
      .select("TO_CHAR(t.transactionDate, 'YYYY-MM-DD')", 'date')
      .addSelect(
        'COALESCE(SUM(CASE WHEN t.transactionType = :income THEN t.credit ELSE 0 END), 0)',
        'income',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN t.transactionType = :expense THEN t.debit ELSE 0 END), 0)',
        'expense',
      )
      .groupBy("TO_CHAR(t.transactionDate, 'YYYY-MM-DD')")
      .orderBy("TO_CHAR(t.transactionDate, 'YYYY-MM-DD')", 'ASC')
      .setParameter('income', TransactionType.INCOME)
      .setParameter('expense', TransactionType.EXPENSE)
      .getRawMany<{ date: string; income: string; expense: string }>();

    const history = extendedRows.map(r => ({
      date: r.date,
      income: Number.parseFloat(r.income) || 0,
      expense: Number.parseFloat(r.expense) || 0,
    }));

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
