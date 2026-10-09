import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, type Repository } from 'typeorm';
import { onlyCounted } from '../../common/utils/counted-transactions.util';
import { readWorkspaceProfile } from '../../common/utils/workspace-profile.util';
import { Invoice, InvoiceStatus } from '../../entities/invoice.entity';
import { Payable, PayableDirection, PayableStatus } from '../../entities/payable.entity';
import { StatementStatus } from '../../entities/statement.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { Workspace } from '../../entities/workspace.entity';
import { DashboardService } from '../dashboard/dashboard.service';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { GoalsService } from '../goals/goals.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import type { ForecastQueryDto } from './dto/forecast-query.dto';
import {
  type AveragedParty,
  addDays,
  computeForecast,
  detectRecurringIncome,
  type ForecastEvent,
  type ForecastResult,
  formatDateOnly,
  projectIncome,
  type RecurringIncome,
  sameParty,
} from './forecast.engine';

export interface ForecastResponse extends ForecastResult {
  currency: string;
  /** 'home' | 'business': the business profile reads the runway, the home one safe-to-spend. */
  profile: 'home' | 'business';
  /** What the everyday average was built from. */
  everydayMonthly: number;
  /** Income per month beyond the detected paydays, from the same history. */
  irregularIncomeMonthly: number;
  monthlyIncome: number;
  monthlyExpense: number;
  monthsObserved: number;
  recurringIncome: Array<RecurringIncome & { sourceId: string }>;
  /** Payables without a due date: owed, but not placeable on the curve. */
  unscheduledCommitted: number;
}

const HISTORY_MONTHS = 3;
const INCOME_LOOKBACK_MONTHS = 12;
/** Dated items are read a year ahead whatever the horizon: the runway is read over a year. */
const PROJECTION_DAYS = 365;
const OPEN_PAYABLE_STATUSES = [
  PayableStatus.TO_PAY,
  PayableStatus.SCHEDULED,
  PayableStatus.OVERDUE,
  PayableStatus.PARTIALLY_PAID,
];

/**
 * Collects the dated money the workspace already knows about and hands it to
 * the pure engine. Payables and subscriptions come from the dashboard's
 * commitments (one definition of "what is owed"), the rest is added here.
 */
@Injectable()
export class ForecastService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Payable)
    private readonly payableRepository: Repository<Payable>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    private readonly dashboardService: DashboardService,
    private readonly goalsService: GoalsService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {}

  async getForecast(workspaceId: string, query: ForecastQueryDto): Promise<ForecastResponse> {
    const horizonDays = query.days ?? 90;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = formatDateOnly(today);
    const projectionDays = Math.max(horizonDays, PROJECTION_DAYS);
    const projectionEnd = addDays(todayKey, projectionDays - 1);

    const workspace = await this.workspaceRepository.findOne({ where: { id: workspaceId } });
    const currency = normalizeCurrency(workspace?.currency);
    const profile = readWorkspaceProfile(workspace);

    const [commitments, receivables, invoices, goals, history, incomeRows] = await Promise.all([
      this.dashboardService.getCommitments(workspaceId, projectionDays),
      this.receivableEvents(workspaceId, currency, todayKey, projectionEnd),
      this.invoiceEvents(workspaceId, currency, todayKey, projectionEnd),
      this.goalEvents(workspaceId, currency, todayKey, projectionEnd),
      this.monthlyHistory(workspaceId, currency, today),
      this.incomeHistory(workspaceId, today),
    ]);

    const recurring = detectRecurringIncome(
      incomeRows.map(row => ({ ...row, amount: Number.parseFloat(row.amount) })),
      todayKey,
    ).map((income, index) => ({
      ...income,
      sourceId: `income:${index}`,
    }));
    const incomeEvents = recurring.flatMap(income =>
      projectIncome(income, income.sourceId, todayKey, projectionEnd),
    );

    const committed: ForecastEvent[] = commitments.items.map(item => ({
      date: item.date,
      label: item.label,
      amount: -item.amount,
      kind: item.source,
      sourceId: item.sourceId,
      isOverdue: item.isOverdue,
    }));

    // Everyday spending = what history says leaves the account beyond the
    // subscriptions the forecast already places on their days. A bill from a
    // party in that history stands in for its share (see the engine).
    const subscriptionsMonthly = await this.subscriptionsMonthly(workspaceId, currency);
    const everydayMonthly = Math.max(0, history.monthlyExpense - subscriptionsMonthly);
    const subscriptionVendors = commitments.items
      .filter(item => item.source === 'subscription')
      .map(item => item.label);
    const expenseParties = history.expenseByParty.filter(
      party => !subscriptionVendors.some(vendor => sameParty(vendor, party.party)),
    );
    // Income beyond the paydays (one-off clients, refunds) is averaged like
    // spending; leaving it out would project only the costs of a freelancer.
    const incomeParties = history.incomeByParty.filter(
      party => !recurring.some(income => sameParty(income.label, party.party)),
    );
    const irregularIncomeMonthly = incomeParties.reduce((sum, party) => sum + party.monthly, 0);

    const result = computeForecast({
      today: todayKey,
      horizonDays,
      openingBalance: commitments.openingBalance,
      events: [...committed, ...receivables, ...invoices, ...goals, ...incomeEvents],
      everydayMonthly,
      irregularIncomeMonthly,
      averagedParties: { expense: expenseParties, income: incomeParties },
      scenario: {
        exclude: query.exclude,
        incomeFactor: query.incomeFactor,
        expenseFactor: query.expenseFactor,
      },
    });

    return {
      ...result,
      currency,
      profile,
      everydayMonthly: round(everydayMonthly),
      irregularIncomeMonthly: round(irregularIncomeMonthly),
      monthlyIncome: round(history.monthlyIncome),
      monthlyExpense: round(history.monthlyExpense),
      monthsObserved: history.monthsObserved,
      recurringIncome: recurring,
      unscheduledCommitted: commitments.unscheduledCommitted,
    };
  }

  /**
   * Open receivables (what the Receive tab lists) on their due date as money
   * in, less what was already paid; an overdue one is expected "now". Undated
   * ones have no day to land on and are left out.
   */
  private async receivableEvents(
    workspaceId: string,
    currency: string,
    today: string,
    horizonEnd: string,
  ): Promise<ForecastEvent[]> {
    const receivables = await this.payableRepository.find({
      where: {
        workspaceId,
        direction: PayableDirection.RECEIVABLE,
        status: In(OPEN_PAYABLE_STATUSES),
        deletedAt: IsNull(),
      },
    });
    const events: ForecastEvent[] = [];
    for (const receivable of receivables) {
      if (!receivable.dueDate) continue;
      // A `date` column arrives as a string, though the entity types it as a Date.
      const due =
        receivable.dueDate instanceof Date
          ? formatDateOnly(receivable.dueDate)
          : String(receivable.dueDate).slice(0, 10);
      const date = due < today ? today : due;
      if (date > horizonEnd) continue;
      const amount = await this.convert(
        Number(receivable.amount) - Number(receivable.paidAmount ?? 0),
        receivable.currency,
        currency,
        workspaceId,
      );
      if (amount <= 0) continue;
      events.push({
        date,
        label: receivable.vendor,
        amount,
        kind: 'invoice',
        sourceId: receivable.id,
        isOverdue: due < today,
      });
    }
    return events;
  }

  /**
   * Sent invoices on their due date as money in; an overdue one is expected
   * "now". An invoice that opened a receivable is counted through it.
   */
  private async invoiceEvents(
    workspaceId: string,
    currency: string,
    today: string,
    horizonEnd: string,
  ): Promise<ForecastEvent[]> {
    const invoices = await this.invoiceRepository.find({
      where: { workspaceId, status: In([InvoiceStatus.SENT, InvoiceStatus.OVERDUE]) },
      relations: ['client'],
    });
    const events: ForecastEvent[] = [];
    for (const invoice of invoices) {
      if (invoice.payableId) continue;
      const due = String(invoice.dueDate).slice(0, 10);
      const date = due < today ? today : due;
      if (date > horizonEnd) continue;
      const amount = await this.convert(
        Number(invoice.total),
        invoice.currency,
        currency,
        workspaceId,
      );
      if (amount === 0) continue;
      events.push({
        date,
        label: invoice.client?.name ?? invoice.invoiceNumber ?? 'Invoice',
        amount,
        kind: 'invoice',
        sourceId: invoice.id,
        isOverdue: due < today,
      });
    }
    return events;
  }

  /**
   * What each dated goal needs per month to be reached on time, placed on the
   * first of every month until its target date. Money set aside is money not
   * available, so it leaves the curve.
   */
  private async goalEvents(
    workspaceId: string,
    currency: string,
    today: string,
    horizonEnd: string,
  ): Promise<ForecastEvent[]> {
    const goals = await this.goalsService.findAll(workspaceId);
    const events: ForecastEvent[] = [];
    for (const goal of goals) {
      if (!goal.targetDate || goal.isReached) continue;
      const target = String(goal.targetDate).slice(0, 10);
      if (target <= today) continue;
      const months = Math.max(1, monthsUntil(today, target));
      const monthly = await this.convert(
        Number(goal.remaining) / months,
        goal.currency,
        currency,
        workspaceId,
      );
      if (monthly <= 0) continue;
      let date = firstOfNextMonth(today);
      while (date <= horizonEnd && date <= target) {
        events.push({
          date,
          label: goal.name,
          amount: -round(monthly),
          kind: 'goal',
          sourceId: goal.id,
        });
        date = firstOfNextMonth(date);
      }
    }
    return events;
  }

  /**
   * Average monthly income and expense over the last full months, in the
   * workspace currency, in total and per counterparty.
   */
  private async monthlyHistory(
    workspaceId: string,
    currency: string,
    today: Date,
  ): Promise<{
    monthlyIncome: number;
    monthlyExpense: number;
    monthsObserved: number;
    incomeByParty: AveragedParty[];
    expenseByParty: AveragedParty[];
  }> {
    const since = new Date(today.getFullYear(), today.getMonth() - HISTORY_MONTHS, 1);
    const until = new Date(today.getFullYear(), today.getMonth(), 0);
    const historyQuery = this.transactionRepository
      .createQueryBuilder('t')
      .innerJoin('t.statement', 's')
      .select('t.currency', 'currency')
      .addSelect('t.counterpartyName', 'party')
      .addSelect(
        'COALESCE(SUM(CASE WHEN t.transactionType = :income THEN t.credit ELSE 0 END), 0)',
        'income',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN t.transactionType = :expense THEN t.debit ELSE 0 END), 0)',
        'expense',
      )
      .where('s.workspaceId = :workspaceId', { workspaceId });
    const rows = await onlyCounted(historyQuery, 't')
      .andWhere('s.deletedAt IS NULL')
      .andWhere('s.status NOT IN (:...excluded)', {
        excluded: [StatementStatus.ERROR, StatementStatus.PROCESSING],
      })
      .andWhere('t.isDuplicate = false')
      .andWhere('t.transferPairId IS NULL')
      .andWhere('t.transactionDate >= :since', { since })
      .andWhere('t.transactionDate <= :until', { until })
      .setParameters({ income: TransactionType.INCOME, expense: TransactionType.EXPENSE })
      .groupBy('t.currency')
      .addGroupBy('t.counterpartyName')
      .getRawMany<{ currency: string; party: string | null; income: string; expense: string }>();

    let income = 0;
    let expense = 0;
    const byParty = new Map<string, { party: string; income: number; expense: number }>();
    for (const row of rows) {
      const rowIncome = await this.convert(
        Number.parseFloat(row.income),
        row.currency,
        currency,
        workspaceId,
      );
      const rowExpense = await this.convert(
        Number.parseFloat(row.expense),
        row.currency,
        currency,
        workspaceId,
      );
      income += rowIncome;
      expense += rowExpense;
      const party = (row.party ?? '').trim();
      if (!party) continue;
      const key = party.toLowerCase();
      const totals = byParty.get(key) ?? { party, income: 0, expense: 0 };
      totals.income += rowIncome;
      totals.expense += rowExpense;
      byParty.set(key, totals);
    }
    // History starts at the first confirmed row: unconfirmed ones do not count yet.
    const earliestQuery = this.transactionRepository
      .createQueryBuilder('t')
      .innerJoin('t.statement', 's')
      .select('MIN(t.transactionDate)', 'first')
      .where('s.workspaceId = :workspaceId', { workspaceId })
      .andWhere('s.deletedAt IS NULL');
    const earliest = await onlyCounted(earliestQuery, 't').getRawOne<{
      first: string | Date | null;
    }>();
    const firstDate = earliest?.first ? new Date(earliest.first) : null;
    // A young workspace has fewer full months than the window; divide by what it has.
    const monthsObserved = firstDate
      ? Math.min(
          HISTORY_MONTHS,
          Math.max(
            1,
            (until.getFullYear() - firstDate.getFullYear()) * 12 +
              (until.getMonth() - firstDate.getMonth()) +
              1,
          ),
        )
      : HISTORY_MONTHS;
    const perMonth = (pick: 'income' | 'expense'): AveragedParty[] =>
      [...byParty.values()]
        .filter(totals => totals[pick] > 0)
        .map(totals => ({ party: totals.party, monthly: totals[pick] / monthsObserved }));
    return {
      monthlyIncome: income / monthsObserved,
      monthlyExpense: expense / monthsObserved,
      monthsObserved,
      incomeByParty: perMonth('income'),
      expenseByParty: perMonth('expense'),
    };
  }

  private async incomeHistory(workspaceId: string, today: Date) {
    const since = new Date(today.getFullYear(), today.getMonth() - INCOME_LOOKBACK_MONTHS, 1);
    const incomeQuery = this.transactionRepository
      .createQueryBuilder('t')
      .innerJoin('t.statement', 's')
      .select([
        't.counterpartyName AS "counterpartyName"',
        't.credit AS amount',
        't.transactionDate AS "transactionDate"',
      ])
      .where('s.workspaceId = :workspaceId', { workspaceId });
    return onlyCounted(incomeQuery, 't')
      .andWhere('s.deletedAt IS NULL')
      .andWhere('t.transactionType = :income', { income: TransactionType.INCOME })
      .andWhere('t.isDuplicate = false')
      .andWhere('t.transferPairId IS NULL')
      .andWhere('t.transactionDate >= :since', { since })
      .orderBy('t.transactionDate', 'ASC')
      .getRawMany<{
        counterpartyName: string | null;
        amount: string;
        transactionDate: string | Date;
      }>();
  }

  private async subscriptionsMonthly(workspaceId: string, _currency: string): Promise<number> {
    const summary = await this.subscriptionsService.getSummary(workspaceId);
    return Number(summary.totalMonthlyCost) || 0;
  }

  private async convert(
    amount: number,
    from: string | null | undefined,
    to: string,
    workspaceId: string,
  ): Promise<number> {
    if (!Number.isFinite(amount) || amount === 0) return 0;
    const source = normalizeCurrency(from);
    if (source === to) return amount;
    const rate = await this.exchangeRatesService.getRate(source, to, undefined, workspaceId);
    return amount * rate;
  }
}

function normalizeCurrency(currency: string | null | undefined): string {
  const normalized = String(currency || '')
    .trim()
    .toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : 'KZT';
}

function monthsUntil(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

function firstOfNextMonth(date: string): string {
  const [y, m] = date.split('-').map(Number);
  return formatDateOnly(new Date(y, m, 1));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
