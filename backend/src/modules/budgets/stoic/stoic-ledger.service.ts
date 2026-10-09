import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { countedSql } from '../../../common/utils/counted-transactions.util';
import { Budget } from '../../../entities/budget.entity';
import { Category, CategoryType, StoicClass } from '../../../entities/category.entity';
import { Transaction, TransactionType } from '../../../entities/transaction.entity';
import { Workspace } from '../../../entities/workspace.entity';
import { ExchangeRatesService } from '../../exchange-rates/exchange-rates.service';
import { buildRateMap, convertWith, normalizeCurrency } from '../../goals/goal-money.util';
import {
  computeMonthRange,
  normalizeLimitToMonth,
  overlapsWindow,
  toMonthKey,
} from '../budget-period.util';
import { suggestHelpsOthers, suggestStoicClass } from './stoic-classifier';

export const STOIC_CLASSES: readonly StoicClass[] = [
  StoicClass.NECESSITY,
  StoicClass.WORK,
  StoicClass.VIRTUE,
  StoicClass.LEISURE,
];

/** Spending or limits per class; `unclassified` holds what no class claims. */
export type StoicTotals = Record<StoicClass | 'unclassified', number>;

export interface StoicMonth {
  /** `YYYY-MM`. */
  month: string;
  /** 0 is the current, still running month. */
  monthsAgo: number;
  /** Budget limits active that month, normalized to a month — what the user meant to spend. */
  intended: StoicTotals;
  /** Expenses that month — what actually happened. */
  actual: StoicTotals;
  /** Budgeted categories whose spending went past their monthly limit. */
  overBudgetCategoryIds: string[];
  /** Spending per category id that month. */
  spentByCategory: Record<string, number>;
  /** Monthly-normalized limit per budgeted category id active that month. */
  limitByCategory: Record<string, number>;
}

export interface StoicCategory {
  id: string;
  name: string;
  parentId: string | null;
  /** The class the ledger uses: the user's, else the parent's, else a suggestion. */
  stoicClass: StoicClass | null;
  source: 'user' | 'suggested' | null;
  /** Whether this money goes to others: the user's word, else the parent's, else a guess. */
  helpsOthers: boolean;
  /** 'user' when someone decided, 'suggested' when it is only the name. */
  helpsOthersSource: 'user' | 'suggested';
  /** Spent in the current month. */
  spent: number;
  /** Whether anything was spent in it over the whole window. */
  active: boolean;
  budgeted: boolean;
}

export interface StoicBalance {
  /** Workspace currency every amount here is converted to. */
  currency: string;
  /** Newest first; index 0 is the current month. */
  months: StoicMonth[];
  categories: StoicCategory[];
}

const emptyTotals = (): StoicTotals => ({
  [StoicClass.NECESSITY]: 0,
  [StoicClass.WORK]: 0,
  [StoicClass.VIRTUE]: 0,
  [StoicClass.LEISURE]: 0,
  unclassified: 0,
});

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Splits a workspace's plan (budget limits) and its reality (expenses) into
 * the four Stoic classes, month by month. The Budgets page draws it and the
 * Stoic advice reads it, so both judge by the same numbers.
 *
 * History is recomputed from transactions rather than stored. The price is
 * that intent for a past month is read from today's budgets, filtered to the
 * ones that already existed and were in their window then — a limit that was
 * changed since is judged at its new value.
 */
@Injectable()
export class StoicLedgerService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Budget)
    private readonly budgetRepository: Repository<Budget>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {}

  async monthlyBalance(workspaceId: string, months = 6, now = new Date()): Promise<StoicBalance> {
    const monthRanges = Array.from({ length: months }, (_, monthsAgo) => {
      const range = computeMonthRange(new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1));
      return { monthsAgo, key: toMonthKey(range.start), range };
    });

    const currency = await this.workspaceCurrency(workspaceId);
    const [categories, budgets, spending] = await Promise.all([
      this.categoryRepository.find({
        where: { workspaceId, type: CategoryType.EXPENSE },
        select: ['id', 'name', 'parentId', 'stoicClass', 'helpsOthers'],
      }),
      this.budgetRepository.find({ where: { workspaceId } }),
      this.loadSpending(
        workspaceId,
        currency,
        monthRanges[months - 1].range.start,
        monthRanges[0].range.end,
      ),
    ]);
    const budgetRates = await buildRateMap(
      this.exchangeRatesService,
      budgets.map(budget => budget.currency),
      currency,
      workspaceId,
    );

    const classOf = this.resolveClasses(categories);
    const budgetedIds = new Set(budgets.map(budget => budget.categoryId));
    const currentKey = monthRanges[0].key;

    const result: StoicMonth[] = monthRanges.map(({ monthsAgo, key, range }) => {
      const intended = emptyTotals();
      const limitByCategory = new Map<string, number>();
      const nextMonthStart = new Date(range.start.getFullYear(), range.start.getMonth() + 1, 1);
      for (const budget of budgets) {
        // A limit set in October says nothing about what was meant in August.
        const existedThatMonth = new Date(budget.createdAt).getTime() < nextMonthStart.getTime();
        if (!(existedThatMonth && overlapsWindow(range, budget))) {
          continue;
        }
        const monthly = normalizeLimitToMonth(
          convertWith(budgetRates, budget.limitAmount, budget.currency),
          budget.periodType,
        );
        intended[classOf.get(budget.categoryId)?.stoicClass ?? 'unclassified'] += monthly;
        limitByCategory.set(
          budget.categoryId,
          (limitByCategory.get(budget.categoryId) ?? 0) + monthly,
        );
      }

      const actual = emptyTotals();
      const monthSpending = spending.get(key) ?? new Map<string, number>();
      for (const [categoryId, total] of monthSpending) {
        actual[classOf.get(categoryId)?.stoicClass ?? 'unclassified'] += total;
      }

      const overBudgetCategoryIds = [...limitByCategory]
        .filter(([categoryId, limit]) => limit > 0 && (monthSpending.get(categoryId) ?? 0) > limit)
        .map(([categoryId]) => categoryId);

      return {
        month: key,
        monthsAgo,
        intended: roundTotals(intended),
        actual: roundTotals(actual),
        overBudgetCategoryIds,
        spentByCategory: roundRecord(monthSpending),
        limitByCategory: roundRecord(limitByCategory),
      };
    });

    const currentSpending = spending.get(currentKey) ?? new Map<string, number>();
    const byId = new Map(categories.map(category => [category.id, category]));
    return {
      currency,
      months: result,
      categories: categories.map(category => ({
        ...this.resolveHelpsOthers(category, byId),
        id: category.id,
        name: category.name,
        parentId: category.parentId,
        stoicClass: classOf.get(category.id)?.stoicClass ?? null,
        source: classOf.get(category.id)?.source ?? null,
        spent: round2(currentSpending.get(category.id) ?? 0),
        active: [...spending.values()].some(month => (month.get(category.id) ?? 0) > 0),
        budgeted: budgetedIds.has(category.id),
      })),
    };
  }

  /**
   * A category the user judged keeps their class; a subcategory the user did
   * not judge inherits its parent's decision before any name-based guess, so
   * judging "Entertainment" once covers everything filed under it.
   */
  private resolveClasses(
    categories: Array<Pick<Category, 'id' | 'name' | 'parentId' | 'stoicClass'>>,
  ): Map<string, { stoicClass: StoicClass | null; source: StoicCategory['source'] }> {
    const byId = new Map(categories.map(category => [category.id, category]));
    const resolved = new Map<
      string,
      { stoicClass: StoicClass | null; source: StoicCategory['source'] }
    >();

    for (const category of categories) {
      const parent = category.parentId ? byId.get(category.parentId) : undefined;
      const userClass = category.stoicClass ?? parent?.stoicClass ?? null;
      if (userClass) {
        resolved.set(category.id, { stoicClass: userClass, source: 'user' });
        continue;
      }
      const suggested = suggestStoicClass(category.name) ?? suggestStoicClass(parent?.name);
      resolved.set(category.id, { stoicClass: suggested, source: suggested ? 'suggested' : null });
    }
    return resolved;
  }

  private resolveHelpsOthers(
    category: Pick<Category, 'name' | 'parentId' | 'helpsOthers'>,
    byId: Map<string, Pick<Category, 'name' | 'helpsOthers'>>,
  ): Pick<StoicCategory, 'helpsOthers' | 'helpsOthersSource'> {
    const parent = category.parentId ? byId.get(category.parentId) : undefined;
    const decided = category.helpsOthers ?? parent?.helpsOthers ?? null;
    if (decided !== null) {
      return { helpsOthers: decided, helpsOthersSource: 'user' };
    }
    return {
      helpsOthers: suggestHelpsOthers(category.name) || suggestHelpsOthers(parent?.name),
      helpsOthersSource: 'suggested',
    };
  }

  /** The workspace's currency, the same fallback the dashboard and goals use. */
  private async workspaceCurrency(workspaceId: string): Promise<string> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      select: ['id', 'currency'],
    });
    return normalizeCurrency(workspace?.currency);
  }

  /**
   * Expenses per month key, then per category, in the workspace currency.
   * Duplicates never count.
   */
  private async loadSpending(
    workspaceId: string,
    currency: string,
    start: Date,
    end: Date,
  ): Promise<Map<string, Map<string, number>>> {
    const rows = await this.transactionRepository
      .createQueryBuilder('t')
      .select('t.category_id', 'categoryId')
      .addSelect("to_char(t.transaction_date, 'YYYY-MM')", 'month')
      .addSelect('t.currency', 'currency')
      .addSelect('COALESCE(SUM(ABS(t.amount)), 0)', 'total')
      .where('t.workspace_id = :workspaceId', { workspaceId })
      .andWhere('t.transaction_type = :type', { type: TransactionType.EXPENSE })
      .andWhere('t.category_id IS NOT NULL')
      .andWhere('t.transaction_date >= :start', { start })
      .andWhere('t.transaction_date <= :end', { end })
      .andWhere('t.is_duplicate = false')
      .andWhere('t.transfer_pair_id IS NULL')
      .andWhere(countedSql('t'))
      .groupBy('t.category_id')
      .addGroupBy("to_char(t.transaction_date, 'YYYY-MM')")
      .addGroupBy('t.currency')
      .getRawMany<{ categoryId: string; month: string; currency: string; total: string }>();
    const rates = await buildRateMap(
      this.exchangeRatesService,
      rows.map(row => row.currency),
      currency,
      workspaceId,
    );

    const byMonth = new Map<string, Map<string, number>>();
    for (const row of rows) {
      const month = byMonth.get(row.month) ?? new Map<string, number>();
      month.set(
        row.categoryId,
        (month.get(row.categoryId) ?? 0) + convertWith(rates, row.total, row.currency),
      );
      byMonth.set(row.month, month);
    }
    return byMonth;
  }
}

function roundTotals(totals: StoicTotals): StoicTotals {
  return Object.fromEntries(
    Object.entries(totals).map(([key, value]) => [key, round2(value)]),
  ) as StoicTotals;
}

function roundRecord(values: Map<string, number>): Record<string, number> {
  return Object.fromEntries([...values].map(([key, value]) => [key, round2(value)]));
}
