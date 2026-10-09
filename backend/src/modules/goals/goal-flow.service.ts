import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { assertFound } from '../../common/utils/assert-found.util';
import { countedSql } from '../../common/utils/counted-transactions.util';
import { Goal, GoalContribution } from '../../entities';
import { Budget, type BudgetPeriodType } from '../../entities/budget.entity';
import type { Category } from '../../entities/category.entity';
import { DataEntry, DataEntryType } from '../../entities/data-entry.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { Workspace } from '../../entities/workspace.entity';
import {
  clampToWindow,
  computeMonthRange,
  computePeriodRange,
  normalizeLimitToMonth,
  overlapsWindow,
  parseMonthKey,
  toMonthKey,
} from '../budgets/budget-period.util';
import { CategoriesService } from '../categories/categories.service';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import {
  buildRateMap,
  convertWith,
  normalizeCurrency,
  round2,
  toDateOnly,
  toNumber,
} from './goal-money.util';

/**
 * How many merchants a category shows before the tail is rolled up. A sankey
 * stops being readable well before the long tail ends.
 */
const MERCHANTS_PER_CATEGORY = 5;

export type GoalFlowNodeKind = 'goal' | 'budget' | 'category' | 'merchant' | 'other';

export interface GoalFlowNode {
  /** `<kind>:<id>` — sankey links address nodes by name, so it must be unique. */
  id: string;
  kind: GoalFlowNodeKind;
  name: string;
  /** Declared intent. Null below the budget level, where nothing was declared. */
  planned: number | null;
  actual: number;
  color: string | null;
  /** Set on the rolled-up tail only: how many merchants it stands for. */
  mergedCount?: number;
}

export interface GoalFlowLink {
  source: string;
  target: string;
  value: number;
}

export interface GoalFlowBudget {
  id: string;
  name: string;
  periodType: BudgetPeriodType;
  /** The limit as the user typed it, in the budget's own currency. */
  limitAmount: number;
  limitCurrency: string;
  /** That limit converted and scaled to one month, which is what the tree sums. */
  plannedMonthly: number;
  actualMonthly: number;
  /** The budget's native window, so these figures reconcile with the budgets page. */
  nativePeriod: { start: string; end: string; actual: number };
  percentUsed: number;
  category: { id: string; name: string; color: string | null; icon: string | null } | null;
}

export interface GoalFlowResponse {
  goal: {
    id: string;
    name: string;
    targetAmount: number;
    currentAmount: number;
    remaining: number;
    targetDate: string | null;
  };
  month: string;
  /** Workspace currency. Every amount below is already converted into it. */
  currency: string;
  plannedTotal: number;
  actualTotal: number;
  /** Positive means overspending against the declared plan. */
  variance: number;
  nodes: GoalFlowNode[];
  links: GoalFlowLink[];
  budgets: GoalFlowBudget[];
  /**
   * Spending the tree cannot place. Cash entries carry no category, so they are
   * counted but never drawn — showing the number beats a silently low total.
   */
  excluded: { cashAmount: number; cashEntryCount: number };
}

interface CategoryTotalRow {
  categoryId: string;
  currency: string;
  total: string;
}

interface MerchantTotalRow {
  categoryId: string;
  merchant: string | null;
  currency: string;
  total: string;
}

/**
 * Reads a goal as a plan-versus-actual tree: the goal, the budgets declared for
 * it, the categories those budgets govern, and the merchants the money actually
 * reached.
 *
 * Two deliberate departures from BudgetsService.computeSpending, which this
 * would otherwise mirror:
 *
 *  - spending rolls up through a category's descendants, not just its exact id,
 *    so a purchase filed under a subcategory still counts against its budget;
 *  - amounts are converted into the workspace currency instead of summed raw
 *    across whatever currencies the rows happen to carry.
 *
 * The transaction filters, though, match the budgets page rather than the
 * dashboard (no statement join, no status gate) — this screen sits next to
 * /budgets and has to agree with it.
 */
@Injectable()
export class GoalFlowService {
  constructor(
    @InjectRepository(Goal)
    private readonly goalRepository: Repository<Goal>,
    @InjectRepository(GoalContribution)
    private readonly contributionRepository: Repository<GoalContribution>,
    @InjectRepository(Budget)
    private readonly budgetRepository: Repository<Budget>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(DataEntry)
    private readonly dataEntryRepository: Repository<DataEntry>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    private readonly categoriesService: CategoriesService,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {}

  async getFlow(
    goalId: string,
    workspaceId: string,
    month: string | undefined,
    now = new Date(),
  ): Promise<GoalFlowResponse> {
    const goal = await this.goalRepository.findOne({ where: { id: goalId, workspaceId } });
    assertFound(goal, 'Goal');

    const anchor = parseMonthKey(month, now);
    const window = computeMonthRange(anchor);
    const currency = await this.getWorkspaceCurrency(workspaceId);

    const [allBudgets, contributed] = await Promise.all([
      this.budgetRepository.find({
        where: { workspaceId, goalId },
        relations: ['category'],
        order: { name: 'ASC' },
      }),
      this.sumContributions(workspaceId, goalId),
    ]);

    // A budget that had ended before this month, or has not started yet, is not
    // part of the month's plan — drawing its limit would inflate `plannedTotal`
    // with money nobody intends to spend.
    const budgets = allBudgets.filter(budget => overlapsWindow(window, budget));

    const { descendants, names: categoryNames } = await this.resolveDescendants(
      workspaceId,
      budgets.map(budget => budget.categoryId),
    );
    const everyCategoryId = [...new Set([...descendants.values()].flat())];

    const [categoryRows, merchantRows, cash] = await Promise.all([
      this.loadCategoryTotals(workspaceId, everyCategoryId, window),
      this.loadMerchantTotals(workspaceId, everyCategoryId, window),
      this.loadCashTotal(workspaceId, window),
    ]);

    const rates = await buildRateMap(
      this.exchangeRatesService,
      [
        ...categoryRows.map(row => row.currency),
        ...merchantRows.map(row => row.currency),
        ...cash.currencies,
        ...budgets.map(budget => budget.currency),
      ],
      currency,
      workspaceId,
    );
    const convert = (amount: string | number, from: string): number =>
      convertWith(rates, amount, from);

    const nativeActuals = await this.loadNativeActuals(
      workspaceId,
      budgets,
      descendants,
      anchor,
      rates,
    );

    const targetAmount = toNumber(goal.targetAmount);
    const nodes: GoalFlowNode[] = [];
    const links: GoalFlowLink[] = [];
    const flowBudgets: GoalFlowBudget[] = [];

    const goalNodeId = `goal:${goal.id}`;
    let plannedTotal = 0;
    let actualTotal = 0;

    for (const budget of budgets) {
      const categoryIds = descendants.get(budget.categoryId) ?? [budget.categoryId];
      const plannedMonthly = normalizeLimitToMonth(
        convert(budget.limitAmount, budget.currency),
        budget.periodType,
      );

      const categoryNodes = this.buildCategoryNodes(
        budget,
        categoryIds,
        categoryNames,
        categoryRows,
        merchantRows,
        convert,
      );
      const budgetActual = categoryNodes.reduce((sum, entry) => sum + entry.node.actual, 0);

      plannedTotal += plannedMonthly;
      actualTotal += budgetActual;

      const budgetNodeId = `budget:${budget.id}`;
      nodes.push({
        id: budgetNodeId,
        kind: 'budget',
        name: budget.name,
        planned: round2(plannedMonthly),
        actual: round2(budgetActual),
        color: budget.category?.color ?? null,
      });
      // A budget with no spending still gets an edge, otherwise an untouched
      // limit vanishes from the picture instead of reading as unused.
      links.push({ source: goalNodeId, target: budgetNodeId, value: round2(budgetActual) });

      for (const entry of categoryNodes) {
        nodes.push(entry.node);
        links.push({
          source: budgetNodeId,
          target: entry.node.id,
          value: entry.node.actual,
        });
        for (const leaf of entry.merchants) {
          nodes.push(leaf);
          links.push({ source: entry.node.id, target: leaf.id, value: leaf.actual });
        }
      }

      const native = nativeActuals.get(budget.id);
      const limitAmount = toNumber(budget.limitAmount);
      flowBudgets.push({
        id: budget.id,
        name: budget.name,
        periodType: budget.periodType,
        limitAmount,
        limitCurrency: budget.currency,
        plannedMonthly: round2(plannedMonthly),
        actualMonthly: round2(budgetActual),
        nativePeriod: {
          start: toDateOnly(native?.start ?? window.start),
          end: toDateOnly(native?.end ?? window.end),
          actual: round2(native?.actual ?? 0),
        },
        percentUsed: plannedMonthly > 0 ? round2((budgetActual / plannedMonthly) * 100) : 0,
        category: budget.category
          ? {
              id: budget.category.id,
              name: budget.category.name,
              color: budget.category.color ?? null,
              icon: budget.category.icon ?? null,
            }
          : null,
      });
    }

    nodes.unshift({
      id: goalNodeId,
      kind: 'goal',
      name: goal.name,
      planned: round2(plannedTotal),
      actual: round2(actualTotal),
      color: null,
    });

    return {
      goal: {
        id: goal.id,
        name: goal.name,
        targetAmount,
        currentAmount: round2(contributed),
        remaining: round2(Math.max(targetAmount - contributed, 0)),
        targetDate: goal.targetDate,
      },
      month: toMonthKey(anchor),
      currency,
      plannedTotal: round2(plannedTotal),
      actualTotal: round2(actualTotal),
      variance: round2(actualTotal - plannedTotal),
      nodes,
      links,
      budgets: flowBudgets,
      excluded: {
        cashAmount: round2(
          cash.rows.reduce((sum, row) => sum + convert(row.total, row.currency), 0),
        ),
        cashEntryCount: cash.count,
      },
    };
  }

  /**
   * Splits one budget's spending into category nodes and their merchant leaves.
   * The tail past MERCHANTS_PER_CATEGORY collapses into a single "other" node so
   * the total still adds up.
   */
  private buildCategoryNodes(
    budget: Budget,
    categoryIds: string[],
    categoryNames: Map<string, string>,
    categoryRows: CategoryTotalRow[],
    merchantRows: MerchantTotalRow[],
    convert: (amount: string | number, from: string) => number,
  ): Array<{ node: GoalFlowNode; merchants: GoalFlowNode[] }> {
    const wanted = new Set(categoryIds);
    const totals = new Map<string, number>();
    for (const row of categoryRows) {
      if (!wanted.has(row.categoryId)) {
        continue;
      }
      totals.set(
        row.categoryId,
        (totals.get(row.categoryId) ?? 0) + convert(row.total, row.currency),
      );
    }

    const merchantsByCategory = new Map<string, Map<string, number>>();
    for (const row of merchantRows) {
      if (!(wanted.has(row.categoryId) && row.merchant)) {
        continue;
      }
      const bucket = merchantsByCategory.get(row.categoryId) ?? new Map<string, number>();
      bucket.set(row.merchant, (bucket.get(row.merchant) ?? 0) + convert(row.total, row.currency));
      merchantsByCategory.set(row.categoryId, bucket);
    }

    return [...totals.entries()]
      .filter(([, amount]) => amount > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([categoryId, amount]) => {
        const nodeId = `category:${categoryId}`;
        const isBudgetCategory = categoryId === budget.categoryId;
        return {
          node: {
            id: nodeId,
            kind: 'category' as const,
            name: categoryNames.get(categoryId) ?? budget.category?.name ?? budget.name,
            planned: null,
            actual: round2(amount),
            color: isBudgetCategory ? (budget.category?.color ?? null) : null,
          },
          merchants: this.buildMerchantNodes(
            categoryId,
            merchantsByCategory.get(categoryId) ?? new Map(),
          ),
        };
      });
  }

  private buildMerchantNodes(categoryId: string, totals: Map<string, number>): GoalFlowNode[] {
    const sorted = [...totals.entries()]
      .filter(([, amount]) => amount > 0)
      .sort(([, a], [, b]) => b - a);

    const head = sorted.slice(0, MERCHANTS_PER_CATEGORY).map(([merchant, amount]) => ({
      id: `merchant:${categoryId}:${merchant}`,
      kind: 'merchant' as const,
      name: merchant,
      planned: null,
      actual: round2(amount),
      color: null,
    }));

    const tail = sorted.slice(MERCHANTS_PER_CATEGORY);
    if (tail.length === 0) {
      return head;
    }

    return [
      ...head,
      {
        id: `other:${categoryId}`,
        kind: 'other' as const,
        // Deliberately unnamed: the client labels the rollup in its own locale,
        // the way the dashboard's `isOther` category does.
        name: '',
        planned: null,
        actual: round2(tail.reduce((sum, [, amount]) => sum + amount, 0)),
        color: null,
        mergedCount: tail.length,
      },
    ];
  }

  /**
   * Expands each budget category into itself plus every descendant, and returns
   * the names alongside so nothing has to be looked up again per node.
   *
   * CategoriesService.findAll is a flat, hour-cached read, so the tree is walked
   * in memory rather than with a recursive query. The result is returned rather
   * than stashed on the service: this is a singleton, and two workspaces reading
   * at once must not see each other's categories.
   */
  private async resolveDescendants(
    workspaceId: string,
    categoryIds: string[],
  ): Promise<{ descendants: Map<string, string[]>; names: Map<string, string> }> {
    const result = new Map<string, string[]>();
    if (categoryIds.length === 0) {
      return { descendants: result, names: new Map() };
    }

    const categories = (await this.categoriesService.findAll(workspaceId)) as Category[];
    const names = new Map(categories.map(category => [category.id, category.name]));

    const childrenOf = new Map<string, string[]>();
    for (const category of categories) {
      if (!category.parentId) {
        continue;
      }
      childrenOf.set(category.parentId, [
        ...(childrenOf.get(category.parentId) ?? []),
        category.id,
      ]);
    }

    for (const rootId of categoryIds) {
      const collected: string[] = [];
      const queue = [rootId];
      const seen = new Set<string>();
      while (queue.length > 0) {
        const current = queue.shift() as string;
        if (seen.has(current)) {
          continue;
        }
        seen.add(current);
        collected.push(current);
        queue.push(...(childrenOf.get(current) ?? []));
      }
      result.set(rootId, collected);
    }

    return { descendants: result, names };
  }

  private async loadCategoryTotals(
    workspaceId: string,
    categoryIds: string[],
    window: { start: Date; end: Date },
  ): Promise<CategoryTotalRow[]> {
    if (categoryIds.length === 0) {
      return [];
    }

    return this.expenseQuery(workspaceId, categoryIds, window)
      .select('t.category_id', 'categoryId')
      .addSelect('t.currency', 'currency')
      .addSelect('COALESCE(SUM(ABS(t.amount)), 0)', 'total')
      .groupBy('t.category_id')
      .addGroupBy('t.currency')
      .getRawMany<CategoryTotalRow>();
  }

  private async loadMerchantTotals(
    workspaceId: string,
    categoryIds: string[],
    window: { start: Date; end: Date },
  ): Promise<MerchantTotalRow[]> {
    if (categoryIds.length === 0) {
      return [];
    }

    // Same merchant key as subscription detection: the normalized vendor when
    // enrichment produced one, the raw counterparty otherwise.
    const merchant = 'LOWER(TRIM(COALESCE(t.vendor_normalized, t.counterparty_name)))';

    return this.expenseQuery(workspaceId, categoryIds, window)
      .select('t.category_id', 'categoryId')
      .addSelect(merchant, 'merchant')
      .addSelect('t.currency', 'currency')
      .addSelect('COALESCE(SUM(ABS(t.amount)), 0)', 'total')
      .groupBy('t.category_id')
      .addGroupBy(merchant)
      .addGroupBy('t.currency')
      .getRawMany<MerchantTotalRow>();
  }

  /**
   * Each budget's spending over its own period, which is what /budgets shows.
   * Reported alongside the monthly figure so the two screens reconcile.
   *
   * Budgets are batched by period type rather than queried one by one: there
   * are only four period types, so this stays at four queries whether the goal
   * carries two budgets or twenty.
   */
  private async loadNativeActuals(
    workspaceId: string,
    budgets: Budget[],
    descendants: Map<string, string[]>,
    anchor: Date,
    rates: Map<string, number>,
  ): Promise<Map<string, { start: Date; end: Date; actual: number }>> {
    const result = new Map<string, { start: Date; end: Date; actual: number }>();

    // Grouped by period *and* window, not period alone: two budgets of the same
    // period type but different lifetimes cover different ranges, and one shared
    // query would charge the shorter one for days outside it. Windows are rare,
    // so in practice this still collapses to one query per period type.
    const byPeriod = new Map<string, Budget[]>();
    for (const budget of budgets) {
      const key = `${budget.periodType}|${budget.startsOn ?? ''}|${budget.endsOn ?? ''}`;
      byPeriod.set(key, [...(byPeriod.get(key) ?? []), budget]);
    }

    await Promise.all(
      [...byPeriod.values()].map(async group => {
        const [first] = group;
        const period = clampToWindow(computePeriodRange(first.periodType, anchor), first);
        if (!period) {
          return;
        }
        const categoryIds = [
          ...new Set(
            group.flatMap(budget => descendants.get(budget.categoryId) ?? [budget.categoryId]),
          ),
        ];
        const rows = await this.loadCategoryTotals(workspaceId, categoryIds, period);

        for (const budget of group) {
          const wanted = new Set(descendants.get(budget.categoryId) ?? [budget.categoryId]);
          const actual = rows
            .filter(row => wanted.has(row.categoryId))
            .reduce(
              (sum, row) =>
                sum + Number(row.total) * (rates.get(normalizeCurrency(row.currency)) ?? 1),
              0,
            );
          result.set(budget.id, { ...period, actual });
        }
      }),
    );

    return result;
  }

  private async loadCashTotal(
    workspaceId: string,
    window: { start: Date; end: Date },
  ): Promise<{
    rows: Array<{ currency: string; total: string }>;
    count: number;
    currencies: string[];
  }> {
    const rows = await this.dataEntryRepository
      .createQueryBuilder('e')
      .select('e.currency', 'currency')
      .addSelect('COALESCE(SUM(ABS(e.amount)), 0)', 'total')
      .addSelect('COUNT(e.id)', 'count')
      .where('e.workspace_id = :workspaceId', { workspaceId })
      .andWhere('e.type = :type', { type: DataEntryType.CASH })
      .andWhere('e.date >= :start', { start: toDateOnly(window.start) })
      .andWhere('e.date <= :end', { end: toDateOnly(window.end) })
      .groupBy('e.currency')
      .getRawMany<{ currency: string; total: string; count: string }>();

    return {
      rows,
      count: rows.reduce((sum, row) => sum + (Number.parseInt(row.count, 10) || 0), 0),
      currencies: rows.map(row => row.currency),
    };
  }

  private expenseQuery(
    workspaceId: string,
    categoryIds: string[],
    window: { start: Date; end: Date },
  ) {
    return this.transactionRepository
      .createQueryBuilder('t')
      .where('t.workspace_id = :workspaceId', { workspaceId })
      .andWhere('t.category_id IN (:...categoryIds)', { categoryIds })
      .andWhere('t.transaction_type = :type', { type: TransactionType.EXPENSE })
      .andWhere('t.transaction_date >= :start', { start: window.start })
      .andWhere('t.transaction_date <= :end', { end: window.end })
      .andWhere('t.is_duplicate = false')
      .andWhere('t.transfer_pair_id IS NULL')
      .andWhere(countedSql('t'));
  }

  private async sumContributions(workspaceId: string, goalId: string): Promise<number> {
    const row = await this.contributionRepository
      .createQueryBuilder('contribution')
      .select('COALESCE(SUM(contribution.amount), 0)', 'total')
      .where('contribution.workspace_id = :workspaceId', { workspaceId })
      .andWhere('contribution.goal_id = :goalId', { goalId })
      .getRawOne<{ total: string }>();

    return toNumber(row?.total);
  }

  private async getWorkspaceCurrency(workspaceId: string): Promise<string> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      select: ['currency'],
    });
    return normalizeCurrency(workspace?.currency);
  }
}
