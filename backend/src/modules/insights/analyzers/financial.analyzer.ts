import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { flowsSql } from '../../../common/utils/counted-transactions.util';
import { Budget } from '../../../entities/budget.entity';
import { InsightCategory, InsightSeverity, InsightType } from '../../../entities/insight.entity';
import { Transaction, TransactionType } from '../../../entities/transaction.entity';
import { Workspace } from '../../../entities/workspace.entity';
import { ExchangeRatesService } from '../../exchange-rates/exchange-rates.service';
import { buildRateMap, convertWith, normalizeCurrency } from '../../goals/goal-money.util';
import { NetWorthService } from '../../net-worth/net-worth.service';
import type { AnalysisContext, InsightAnalyzer, InsightCandidate } from './analyzer.interface';

/** How many fully-elapsed months a category is compared against. */
const TRAILING_MONTHS = 3;
/** A category has to beat its own trailing average by this much to be worth a word. */
const RISING_CATEGORY_THRESHOLD_PERCENT = 25;
/**
 * ...and by at least this much money. A rise from a small base looks dramatic
 * in percent (2.88 to 6.61 is +129%) while being a few coins. The floor is set
 * in US dollars and converted to the workspace currency, so it means the same
 * in a KZT workspace as in a USD one.
 */
const RISING_CATEGORY_MIN_INCREASE = { currency: 'USD', amount: 50 } as const;
/** Savings rate moves a few points every month; only a real swing is reported. */
const SAVINGS_RATE_THRESHOLD_POINTS = 5;
/**
 * The 80/20 rule: at most a fifth of capital exposed, the rest at zero risk.
 * A constant rather than a setting, like the thresholds above — if workspaces
 * start needing their own numbers, all four should move together.
 */
const RISKY_ALLOCATION_THRESHOLD_PERCENT = 20;

interface CategoryMonthTotal {
  categoryId: string;
  categoryName: string;
  monthIndex: number;
  total: number;
}

/**
 * Financial early-warning signals, computed from data the workspace already
 * has. Complements OperationalAnalyzer, which is about the state of the data
 * ("21 transactions have no category") rather than the state of the money.
 *
 * Budget overruns are deliberately absent: BudgetsService already raises those
 * as notifications at 80% and 100%, and a second copy in a different feed
 * would just be noise. What is missing there — and covered here — is spending
 * that has no budget watching it at all.
 */
@Injectable()
export class FinancialAnalyzer implements InsightAnalyzer {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Budget)
    private readonly budgetRepository: Repository<Budget>,
    private readonly netWorthService: NetWorthService,
    private readonly exchangeRatesService: ExchangeRatesService,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
  ) {}

  /**
   * Sums `rows` per key in the workspace currency. Rows come per currency, so
   * 500 UAH is never read as 500 of the workspace's money; a currency with no
   * rate counts as nothing (see `convertWith`).
   */
  private async inWorkspaceCurrency<T extends { currency: string | null }>(
    workspaceId: string,
    rows: T[],
  ): Promise<(row: T, amount: string | number) => number> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      select: {
        id: true,
        currency: true,
      },
    });
    const currency = normalizeCurrency(workspace?.currency);
    const rates = await buildRateMap(
      this.exchangeRatesService,
      rows.map(row => row.currency ?? currency),
      currency,
      workspaceId,
    );
    return (row, amount) => convertWith(rates, amount, row.currency ?? currency);
  }

  async analyze(context: AnalysisContext): Promise<InsightCandidate[]> {
    // Every signal below compares categories and totals across a whole
    // workspace; without one there is nothing coherent to aggregate.
    if (!context.workspaceId) {
      return [];
    }

    const now = new Date();
    const [categoryTotals, savingsRate, riskyAllocation] = await Promise.all([
      this.loadCategoryTotals(context.workspaceId, now),
      this.savingsRateAdvice(context.workspaceId, now),
      this.riskyAllocationAdvice(context.workspaceId),
    ]);

    const candidates = await Promise.all([
      this.risingCategoryAdvice(context.workspaceId, categoryTotals, now),
      this.unbudgetedTopCategoryAdvice(context.workspaceId, categoryTotals),
    ]);

    return [...candidates, savingsRate, riskyAllocation].filter(
      (item): item is InsightCandidate => item !== null,
    );
  }

  /**
   * Too much capital sitting in medium or high risk.
   *
   * The share comes from NetWorthService rather than being recomputed here, so
   * the number in the warning is the same one the Net Worth page shows. It
   * only counts risk the user has actually assigned, which means the warning
   * can arrive late but never out of nowhere.
   */
  private async riskyAllocationAdvice(workspaceId: string): Promise<InsightCandidate | null> {
    const netWorth = await this.netWorthService.getNetWorth(workspaceId, '30d');

    if (netWorth.riskyPercent <= RISKY_ALLOCATION_THRESHOLD_PERCENT) {
      return null;
    }

    return {
      type: InsightType.RISKY_ALLOCATION,
      category: InsightCategory.PATTERN,
      severity: InsightSeverity.WARN,
      messageKey: 'pattern.risky_allocation',
      messageParams: {
        percent: Math.round(netWorth.riskyPercent),
        threshold: RISKY_ALLOCATION_THRESHOLD_PERCENT,
      },
      deduplicationKey: `financial:risky_allocation:${workspaceId}`,
      data: {
        riskyPercent: netWorth.riskyPercent,
        threshold: RISKY_ALLOCATION_THRESHOLD_PERCENT,
        assetsTotal: netWorth.assetsTotal,
      },
      actions: [{ type: 'VIEW_REPORT', payload: { workspaceId } }],
      expiresAt: endOfMonth(new Date()),
    };
  }

  /**
   * Expense totals per category for the current month (monthIndex 0) and the
   * three months before it, in one pass — the rising-category and
   * unbudgeted-category signals both read from this.
   */
  private async loadCategoryTotals(workspaceId: string, now: Date): Promise<CategoryMonthTotal[]> {
    const { start } = monthBounds(now, TRAILING_MONTHS);
    const { end } = monthBounds(now, 0);

    const rows = await this.transactionRepository
      .createQueryBuilder('t')
      .innerJoin('t.category', 'category')
      .select('t.category_id', 'categoryId')
      .addSelect('category.name', 'categoryName')
      .addSelect("date_trunc('month', t.transaction_date)", 'month')
      .addSelect('t.currency', 'currency')
      .addSelect('COALESCE(SUM(ABS(t.amount)), 0)', 'total')
      .where('t.workspace_id = :workspaceId', { workspaceId })
      .andWhere('t.transaction_type = :type', { type: TransactionType.EXPENSE })
      .andWhere('t.transaction_date >= :start', { start })
      .andWhere('t.transaction_date <= :end', { end })
      .andWhere('t.is_duplicate = false')
      .andWhere('t.transfer_pair_id IS NULL')
      .andWhere(flowsSql('t'))
      .groupBy('t.category_id')
      .addGroupBy('category.name')
      .addGroupBy("date_trunc('month', t.transaction_date)")
      .addGroupBy('t.currency')
      .getRawMany<{
        categoryId: string;
        categoryName: string;
        month: string;
        currency: string | null;
        total: string;
      }>();

    const convert = await this.inWorkspaceCurrency(workspaceId, rows);
    const totals = new Map<string, CategoryMonthTotal>();
    for (const row of rows) {
      const monthIndex = monthsBetween(new Date(row.month), now);
      const key = `${row.categoryId}:${monthIndex}`;
      const entry = totals.get(key) ?? {
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        monthIndex,
        total: 0,
      };
      entry.total += convert(row, row.total);
      totals.set(key, entry);
    }
    return [...totals.values()];
  }

  /**
   * The expense category furthest above its own trailing average. A category
   * with no history is skipped rather than reported as an infinite increase —
   * the first month of anything always looks like a spike.
   */
  private async risingCategoryAdvice(
    workspaceId: string,
    totals: CategoryMonthTotal[],
    now: Date,
  ): Promise<InsightCandidate | null> {
    const trailingByCategory = new Map<string, number>();
    for (const row of totals.filter(item => item.monthIndex !== 0)) {
      trailingByCategory.set(
        row.categoryId,
        (trailingByCategory.get(row.categoryId) ?? 0) + row.total,
      );
    }

    const minIncrease = await this.risingCategoryMinIncrease(workspaceId);
    const rises = totals
      .filter(row => row.monthIndex === 0)
      .map(row => ({
        row,
        average: (trailingByCategory.get(row.categoryId) ?? 0) / TRAILING_MONTHS,
      }))
      .filter(item => item.average > 0)
      .map(item => ({
        ...item,
        increasePercent: ((item.row.total - item.average) / item.average) * 100,
      }))
      .filter(item => item.increasePercent >= RISING_CATEGORY_THRESHOLD_PERCENT)
      .filter(item => item.row.total - item.average >= minIncrease)
      .sort((a, b) => b.increasePercent - a.increasePercent);

    const best = rises[0] ?? null;

    if (best === null) {
      return null;
    }

    return {
      type: InsightType.SPENDING_TREND_UP,
      category: InsightCategory.TREND,
      severity: InsightSeverity.WARN,
      messageKey: 'trend.category_rising',
      messageParams: {
        category: best.row.categoryName,
        percent: Math.round(best.increasePercent),
      },
      deduplicationKey: `financial:category_rising:${workspaceId}:${best.row.categoryId}`,
      data: {
        // The month the comparison is about: the link carries it so the
        // leaderboard it opens shows this month's total, not an all-time one.
        month: monthKey(now),
        categoryId: best.row.categoryId,
        categoryName: best.row.categoryName,
        current: round2(best.row.total),
        average: round2(best.average),
        increasePercent: Math.round(best.increasePercent),
      },
      actions: [
        {
          type: 'VIEW_REPORT',
          payload: { workspaceId, categoryId: best.row.categoryId },
        },
      ],
      expiresAt: endOfMonth(new Date()),
    };
  }

  /**
   * The money floor for a rising category, in the workspace currency. With no
   * rate for the floor's currency it falls back to the same number of
   * workspace units: a lower floor, but still one.
   */
  private async risingCategoryMinIncrease(workspaceId: string): Promise<number> {
    const floor = { currency: RISING_CATEGORY_MIN_INCREASE.currency };
    const convert = await this.inWorkspaceCurrency(workspaceId, [floor]);
    return (
      convert(floor, RISING_CATEGORY_MIN_INCREASE.amount) || RISING_CATEGORY_MIN_INCREASE.amount
    );
  }

  /** This month's largest expense category that no budget is watching. */
  private async unbudgetedTopCategoryAdvice(
    workspaceId: string,
    totals: CategoryMonthTotal[],
  ): Promise<InsightCandidate | null> {
    const currentMonth = totals
      .filter(row => row.monthIndex === 0)
      .sort((a, b) => b.total - a.total);
    if (currentMonth.length === 0) {
      return null;
    }

    const budgets = await this.budgetRepository.find({
      where: { workspaceId },
      select: {
        categoryId: true,
      },
    });
    const budgetedIds = new Set(budgets.map(budget => budget.categoryId));

    const top = currentMonth.find(row => !budgetedIds.has(row.categoryId));
    if (!top) {
      return null;
    }

    return {
      type: InsightType.CATEGORY_DOMINANCE,
      category: InsightCategory.PATTERN,
      severity: InsightSeverity.INFO,
      messageKey: 'pattern.unbudgeted_top_category',
      messageParams: { category: top.categoryName },
      deduplicationKey: `financial:unbudgeted_top:${workspaceId}:${top.categoryId}`,
      data: {
        categoryId: top.categoryId,
        categoryName: top.categoryName,
        amount: round2(top.total),
      },
      expiresAt: endOfMonth(new Date()),
    };
  }

  /**
   * Savings rate (net / income) this month against last month.
   *
   * Both months are read as-is, including the current partial one: the point
   * is to notice the shift while it can still be acted on. A month with no
   * income is skipped — a share of zero is not 0%, it is undefined.
   */
  private async savingsRateAdvice(
    workspaceId: string,
    now: Date,
  ): Promise<InsightCandidate | null> {
    const [current, previous] = await Promise.all([
      this.monthlyTotals(workspaceId, now, 0),
      this.monthlyTotals(workspaceId, now, 1),
    ]);

    if (current.income <= 0 || previous.income <= 0) {
      return null;
    }

    const currentRate = ((current.income - current.spent) / current.income) * 100;
    const previousRate = ((previous.income - previous.spent) / previous.income) * 100;
    const diff = currentRate - previousRate;

    if (Math.abs(diff) < SAVINGS_RATE_THRESHOLD_POINTS) {
      return null;
    }

    const isUp = diff > 0;
    return {
      type: InsightType.SAVINGS_RATE_TREND,
      category: InsightCategory.TREND,
      severity: isUp ? InsightSeverity.INFO : InsightSeverity.WARN,
      messageKey: isUp ? 'trend.savings_rate_up' : 'trend.savings_rate_down',
      messageParams: { rate: Math.round(currentRate), diff: Math.abs(Math.round(diff)) },
      deduplicationKey: `financial:savings_rate:${workspaceId}:${monthKey(now)}`,
      data: {
        month: monthKey(now),
        currentRate: Math.round(currentRate),
        previousRate: Math.round(previousRate),
        income: round2(current.income),
        spent: round2(current.spent),
      },
      expiresAt: endOfMonth(now),
    };
  }

  private async monthlyTotals(
    workspaceId: string,
    now: Date,
    monthsAgo: number,
  ): Promise<{ income: number; spent: number }> {
    const { start, end } = monthBounds(now, monthsAgo);

    const rows = await this.transactionRepository
      .createQueryBuilder('t')
      .select('t.currency', 'currency')
      .addSelect(
        'COALESCE(SUM(CASE WHEN t.transaction_type = :income THEN ABS(t.amount) ELSE 0 END), 0)',
        'income',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN t.transaction_type = :expense THEN ABS(t.amount) ELSE 0 END), 0)',
        'spent',
      )
      .where('t.workspace_id = :workspaceId', { workspaceId })
      .andWhere('t.transaction_date >= :start', { start })
      .andWhere('t.transaction_date <= :end', { end })
      .andWhere('t.is_duplicate = false')
      .andWhere('t.transfer_pair_id IS NULL')
      .andWhere(flowsSql('t'))
      .setParameters({ income: TransactionType.INCOME, expense: TransactionType.EXPENSE })
      .groupBy('t.currency')
      .getRawMany<{ currency: string | null; income: string; spent: string }>();

    const convert = await this.inWorkspaceCurrency(workspaceId, rows);
    return rows.reduce(
      (sum, row) => ({
        income: sum.income + convert(row, row.income),
        spent: sum.spent + convert(row, row.spent),
      }),
      { income: 0, spent: 0 },
    );
  }
}

function monthBounds(now: Date, monthsAgo: number): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0);
  return { start, end };
}

function monthsBetween(earlier: Date, later: Date): number {
  return (
    (later.getFullYear() - earlier.getFullYear()) * 12 + (later.getMonth() - earlier.getMonth())
  );
}

function endOfMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

function monthKey(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
