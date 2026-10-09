import { countedSql } from '@/common/utils/counted-transactions.util';
import { NotFoundException } from '@nestjs/common';
import { BudgetPeriodType } from '@/entities/budget.entity';
import { GoalFlowService } from '@/modules/goals/goal-flow.service';

const WORKSPACE_ID = 'workspace-1';
const GOAL_ID = 'goal-1';

interface Rows {
  categories?: Array<{ categoryId: string; currency: string; total: string }>;
  merchants?: Array<{
    categoryId: string;
    merchant: string | null;
    currency: string;
    total: string;
  }>;
  cash?: Array<{ currency: string; total: string; count: string }>;
}

/**
 * One builder mock serves both transaction queries. Which rows come back is
 * decided by whether the caller asked for the merchant alias, mirroring how the
 * service distinguishes its two aggregates.
 */
function createTransactionRepo(rows: Rows) {
  const calls: string[][] = [];
  /** Every condition each transaction query was given, one list per query. */
  const conditions: string[][] = [];

  const createQueryBuilder = jest.fn(() => {
    const aliases: string[] = [];
    const clauses: string[] = [];
    calls.push(aliases);
    conditions.push(clauses);
    const builder: Record<string, unknown> = {
      select: jest.fn(() => builder),
      addSelect: jest.fn((_expression: string, alias: string) => {
        aliases.push(alias);
        return builder;
      }),
      where: jest.fn(() => builder),
      andWhere: jest.fn((clause: string) => {
        clauses.push(clause);
        return builder;
      }),
      groupBy: jest.fn(() => builder),
      addGroupBy: jest.fn(() => builder),
      getRawMany: jest.fn(async () =>
        aliases.includes('merchant') ? (rows.merchants ?? []) : (rows.categories ?? []),
      ),
    };
    return builder;
  });

  return { repo: { createQueryBuilder } as never, createQueryBuilder, conditions };
}

function createService(options: {
  goal?: Record<string, unknown> | null;
  budgets?: Array<Record<string, unknown>>;
  categories?: Array<{ id: string; name: string; parentId: string | null }>;
  rows?: Rows;
  contributed?: string;
  workspaceCurrency?: string | null;
  rate?: number;
}) {
  const {
    repo: transactionRepository,
    createQueryBuilder,
    conditions,
  } = createTransactionRepo(
    options.rows ?? {},
  );

  const goalRepository = {
    findOne: jest.fn(async () => options.goal ?? null),
  } as never;

  const contributionRepository = {
    createQueryBuilder: jest.fn(() => {
      const builder: Record<string, unknown> = {
        select: jest.fn(() => builder),
        where: jest.fn(() => builder),
        andWhere: jest.fn(() => builder),
        getRawOne: jest.fn(async () => ({ total: options.contributed ?? '0' })),
      };
      return builder;
    }),
  } as never;

  const budgetRepository = {
    find: jest.fn(async () => options.budgets ?? []),
  } as never;

  const dataEntryRepository = {
    createQueryBuilder: jest.fn(() => {
      const builder: Record<string, unknown> = {
        select: jest.fn(() => builder),
        addSelect: jest.fn(() => builder),
        where: jest.fn(() => builder),
        andWhere: jest.fn(() => builder),
        groupBy: jest.fn(() => builder),
        getRawMany: jest.fn(async () => options.rows?.cash ?? []),
      };
      return builder;
    }),
  } as never;

  const workspaceRepository = {
    findOne: jest.fn(async () => ({ currency: options.workspaceCurrency ?? 'KZT' })),
  } as never;

  const categoriesService = {
    findAll: jest.fn(async () => options.categories ?? []),
  } as never;

  const exchangeRatesService = {
    getRate: jest.fn(async () => options.rate ?? 1),
  } as never;

  return {
    service: new GoalFlowService(
      goalRepository,
      contributionRepository,
      budgetRepository,
      transactionRepository,
      dataEntryRepository,
      workspaceRepository,
      categoriesService,
      exchangeRatesService,
    ),
    createQueryBuilder,
    conditions,
    exchangeRatesService: exchangeRatesService as unknown as { getRate: jest.Mock },
  };
}

const goal = {
  id: GOAL_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Renovation',
  targetAmount: 1000,
  currency: 'KZT',
  targetDate: '2027-01-01',
};

const budget = (overrides: Record<string, unknown> = {}) => ({
  id: 'budget-1',
  workspaceId: WORKSPACE_ID,
  name: 'Materials',
  categoryId: 'category-1',
  limitAmount: 500,
  currency: 'KZT',
  periodType: BudgetPeriodType.MONTHLY,
  category: { id: 'category-1', name: 'Home', color: '#123456', icon: 'home' },
  ...overrides,
});

describe('GoalFlowService', () => {
  const anchor = new Date(2026, 4, 8);

  it('refuses a goal that belongs to another workspace', async () => {
    const { service } = createService({ goal: null });

    await expect(service.getFlow(GOAL_ID, WORKSPACE_ID, undefined, anchor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('counts spending filed under a subcategory against the parent budget', async () => {
    const { service } = createService({
      goal,
      budgets: [budget()],
      categories: [
        { id: 'category-1', name: 'Home', parentId: null },
        { id: 'category-1a', name: 'Tiles', parentId: 'category-1' },
      ],
      rows: {
        categories: [{ categoryId: 'category-1a', currency: 'KZT', total: '120' }],
      },
    });

    const result = await service.getFlow(GOAL_ID, WORKSPACE_ID, undefined, anchor);

    expect(result.actualTotal).toBe(120);
    expect(result.nodes.find(node => node.id === 'budget-1' || node.kind === 'budget')?.actual).toBe(
      120,
    );
    expect(result.nodes.some(node => node.id === 'category:category-1a')).toBe(true);
  });

  it('counts only the spending the user confirmed', async () => {
    const { service, conditions } = createService({
      goal,
      budgets: [budget()],
      categories: [{ id: 'category-1', name: 'Home', parentId: null }],
    });

    await service.getFlow(GOAL_ID, WORKSPACE_ID, undefined, anchor);

    expect(conditions.length).toBeGreaterThan(0);
    for (const clauses of conditions) {
      expect(clauses).toContain(countedSql('t'));
    }
  });

  it('converts every currency into the workspace currency', async () => {
    const { service, exchangeRatesService } = createService({
      goal,
      budgets: [budget({ currency: 'USD', limitAmount: 100 })],
      categories: [{ id: 'category-1', name: 'Home', parentId: null }],
      rows: { categories: [{ categoryId: 'category-1', currency: 'USD', total: '10' }] },
      workspaceCurrency: 'KZT',
      rate: 500,
    });

    const result = await service.getFlow(GOAL_ID, WORKSPACE_ID, undefined, anchor);

    expect(result.currency).toBe('KZT');
    expect(result.actualTotal).toBe(5000);
    expect(result.plannedTotal).toBe(50000);
    // One lookup for the single distinct source currency, not one per row.
    expect(exchangeRatesService.getRate).toHaveBeenCalledTimes(1);
  });

  it('puts a weekly limit on the same monthly axis as a monthly one', async () => {
    const { service } = createService({
      goal,
      budgets: [budget({ periodType: BudgetPeriodType.WEEKLY, limitAmount: 120 })],
      categories: [{ id: 'category-1', name: 'Home', parentId: null }],
    });

    const result = await service.getFlow(GOAL_ID, WORKSPACE_ID, undefined, anchor);

    expect(result.plannedTotal).toBeCloseTo(520, 2);
    expect(result.budgets[0].limitAmount).toBe(120);
    expect(result.budgets[0].periodType).toBe(BudgetPeriodType.WEEKLY);
  });

  it('rolls merchants past the top five into one unnamed node', async () => {
    const merchants = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((name, index) => ({
      categoryId: 'category-1',
      merchant: name,
      currency: 'KZT',
      total: String(100 - index),
    }));

    const { service } = createService({
      goal,
      budgets: [budget()],
      categories: [{ id: 'category-1', name: 'Home', parentId: null }],
      rows: {
        categories: [{ categoryId: 'category-1', currency: 'KZT', total: '679' }],
        merchants,
      },
    });

    const result = await service.getFlow(GOAL_ID, WORKSPACE_ID, undefined, anchor);

    const leaves = result.nodes.filter(node => node.kind === 'merchant');
    const other = result.nodes.find(node => node.kind === 'other');
    expect(leaves).toHaveLength(5);
    expect(other?.mergedCount).toBe(2);
    // 95 + 94, the tail the chart no longer draws individually.
    expect(other?.actual).toBe(189);
    expect(other?.name).toBe('');
  });

  it('reports cash outside the tree instead of quietly dropping it', async () => {
    const { service } = createService({
      goal,
      budgets: [budget()],
      categories: [{ id: 'category-1', name: 'Home', parentId: null }],
      rows: {
        categories: [{ categoryId: 'category-1', currency: 'KZT', total: '100' }],
        cash: [{ currency: 'KZT', total: '40', count: '3' }],
      },
    });

    const result = await service.getFlow(GOAL_ID, WORKSPACE_ID, undefined, anchor);

    expect(result.actualTotal).toBe(100);
    expect(result.excluded).toEqual({ cashAmount: 40, cashEntryCount: 3 });
  });

  it('does not issue more queries as the goal gains budgets of the same period', async () => {
    const oneBudget = createService({
      goal,
      budgets: [budget()],
      categories: [{ id: 'category-1', name: 'Home', parentId: null }],
    });
    await oneBudget.service.getFlow(GOAL_ID, WORKSPACE_ID, undefined, anchor);

    const fourBudgets = createService({
      goal,
      budgets: [
        budget(),
        budget({ id: 'budget-2', categoryId: 'category-2' }),
        budget({ id: 'budget-3', categoryId: 'category-3' }),
        budget({ id: 'budget-4', categoryId: 'category-4' }),
      ],
      categories: [
        { id: 'category-1', name: 'Home', parentId: null },
        { id: 'category-2', name: 'Tools', parentId: null },
        { id: 'category-3', name: 'Paint', parentId: null },
        { id: 'category-4', name: 'Labour', parentId: null },
      ],
    });
    await fourBudgets.service.getFlow(GOAL_ID, WORKSPACE_ID, undefined, anchor);

    expect(fourBudgets.createQueryBuilder).toHaveBeenCalledTimes(
      oneBudget.createQueryBuilder.mock.calls.length,
    );
  });

  it('echoes the requested month and reports the budget native window alongside it', async () => {
    const { service } = createService({
      goal,
      budgets: [budget({ periodType: BudgetPeriodType.QUARTERLY, limitAmount: 3000 })],
      categories: [{ id: 'category-1', name: 'Home', parentId: null }],
    });

    const result = await service.getFlow(GOAL_ID, WORKSPACE_ID, '2026-02', anchor);

    expect(result.month).toBe('2026-02');
    expect(result.plannedTotal).toBe(1000);
    expect(result.budgets[0].nativePeriod.start).toBe('2026-01-01');
    expect(result.budgets[0].nativePeriod.end).toBe('2026-03-31');
  });

  it('keeps an untouched budget on the chart rather than dropping the edge', async () => {
    const { service } = createService({
      goal,
      budgets: [budget()],
      categories: [{ id: 'category-1', name: 'Home', parentId: null }],
      rows: { categories: [] },
    });

    const result = await service.getFlow(GOAL_ID, WORKSPACE_ID, undefined, anchor);

    expect(result.links).toContainEqual({
      source: `goal:${GOAL_ID}`,
      target: 'budget:budget-1',
      value: 0,
    });
    expect(result.variance).toBe(-500);
  });
});
