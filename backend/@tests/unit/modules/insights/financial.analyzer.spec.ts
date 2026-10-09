import { countedSql } from '@/common/utils/counted-transactions.util';
import { InsightSeverity, InsightType } from '@/entities/insight.entity';
import { FinancialAnalyzer } from '@/modules/insights/analyzers/financial.analyzer';

const CONTEXT = { userId: 'user-1', workspaceId: 'workspace-1' };

/** `date_trunc('month', ...)` output for the month `monthsAgo` before now. */
function monthStart(monthsAgo: number): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1).toISOString();
}

function categoryRow(
  categoryId: string,
  categoryName: string,
  monthsAgo: number,
  total: number,
) {
  return { categoryId, categoryName, month: monthStart(monthsAgo), total: String(total) };
}

/**
 * The analyzer runs one grouped category query and two monthly-total queries.
 * `categoryRows` answers the first, `monthlyTotals` answers the rest in the
 * order the analyzer asks for them (current month, then previous).
 */
function createTransactionRepository(options: {
  categoryRows?: ReturnType<typeof categoryRow>[];
  monthlyTotals?: Array<{ income: string; spent: string }>;
}) {
  const monthlyTotals = [...(options.monthlyTotals ?? [])];

  const builder: any = {
    innerJoin: jest.fn(() => builder),
    select: jest.fn(() => builder),
    addSelect: jest.fn(() => builder),
    where: jest.fn(() => builder),
    andWhere: jest.fn(() => builder),
    groupBy: jest.fn(() => builder),
    addGroupBy: jest.fn(() => builder),
    setParameters: jest.fn(() => builder),
    getRawMany: jest.fn(async () => options.categoryRows ?? []),
    getRawOne: jest.fn(async () => monthlyTotals.shift() ?? { income: '0', spent: '0' }),
  };

  return { createQueryBuilder: jest.fn(() => builder) } as any;
}

function createBudgetRepository(categoryIds: string[]) {
  return { find: jest.fn(async () => categoryIds.map(categoryId => ({ categoryId }))) } as any;
}

/** The analyzer only reads riskyPercent and the totals shown alongside it. */
function createNetWorthService(riskyPercent = 0) {
  return {
    getNetWorth: jest.fn(async () => ({ riskyPercent, assetsTotal: 1000 })),
  } as any;
}

describe('FinancialAnalyzer', () => {
  it('returns nothing without a workspace to aggregate over', async () => {
    const analyzer = new FinancialAnalyzer(
      createTransactionRepository({}),
      createBudgetRepository([]),
      createNetWorthService(),
    );

    const results = await analyzer.analyze({ userId: 'user-1', workspaceId: null });

    expect(results).toEqual([]);
  });

  it('flags the category furthest above its own trailing average', async () => {
    const analyzer = new FinancialAnalyzer(
      createTransactionRepository({
        categoryRows: [
          // 300 now vs an average of 100 — a 200% jump.
          categoryRow('cat-1', 'Такси', 0, 300),
          categoryRow('cat-1', 'Такси', 1, 100),
          categoryRow('cat-1', 'Такси', 2, 100),
          categoryRow('cat-1', 'Такси', 3, 100),
          // 130 now vs an average of 100 — a smaller 30% jump.
          categoryRow('cat-2', 'Кафе', 0, 130),
          categoryRow('cat-2', 'Кафе', 1, 100),
          categoryRow('cat-2', 'Кафе', 2, 100),
          categoryRow('cat-2', 'Кафе', 3, 100),
        ],
      }),
      createBudgetRepository(['cat-1', 'cat-2']),
      createNetWorthService(),
    );

    const results = await analyzer.analyze(CONTEXT);
    const rising = results.find(item => item.type === InsightType.SPENDING_TREND_UP);

    expect(rising).toBeDefined();
    expect(rising).toMatchObject({
      messageKey: 'trend.category_rising',
      messageParams: { category: 'Такси', percent: 200 },
      severity: InsightSeverity.WARN,
    });
    // The link opens the leaderboard on this month, so the row it rings shows
    // the total the advice quoted rather than an all-time one.
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    expect(rising?.data).toMatchObject({ month, categoryName: 'Такси' });
  });

  it('ignores a category whose spending is below the rising threshold', async () => {
    const analyzer = new FinancialAnalyzer(
      createTransactionRepository({
        categoryRows: [
          categoryRow('cat-2', 'Кафе', 0, 110),
          categoryRow('cat-2', 'Кафе', 1, 100),
          categoryRow('cat-2', 'Кафе', 2, 100),
          categoryRow('cat-2', 'Кафе', 3, 100),
        ],
      }),
      createBudgetRepository(['cat-2']),
      createNetWorthService(),
    );

    const results = await analyzer.analyze(CONTEXT);

    expect(results.some(item => item.type === InsightType.SPENDING_TREND_UP)).toBe(false);
  });

  it('ignores a category with no history instead of reporting an infinite jump', async () => {
    const analyzer = new FinancialAnalyzer(
      createTransactionRepository({
        categoryRows: [categoryRow('cat-new', 'Ремонт', 0, 5000)],
      }),
      createBudgetRepository(['cat-new']),
      createNetWorthService(),
    );

    const results = await analyzer.analyze(CONTEXT);

    expect(results.some(item => item.type === InsightType.SPENDING_TREND_UP)).toBe(false);
  });

  it('names the largest current-month category that no budget covers', async () => {
    const analyzer = new FinancialAnalyzer(
      createTransactionRepository({
        categoryRows: [
          categoryRow('cat-1', 'Аренда', 0, 900),
          categoryRow('cat-2', 'Кафе', 0, 400),
          categoryRow('cat-3', 'Такси', 0, 200),
        ],
      }),
      createBudgetRepository(['cat-1']),
      createNetWorthService(),
    );

    const results = await analyzer.analyze(CONTEXT);
    const unbudgeted = results.find(item => item.type === InsightType.CATEGORY_DOMINANCE);

    expect(unbudgeted).toMatchObject({
      messageKey: 'pattern.unbudgeted_top_category',
      messageParams: { category: 'Кафе' },
    });
  });

  it('says nothing when every current-month category already has a budget', async () => {
    const analyzer = new FinancialAnalyzer(
      createTransactionRepository({
        categoryRows: [categoryRow('cat-1', 'Аренда', 0, 900)],
      }),
      createBudgetRepository(['cat-1']),
      createNetWorthService(),
    );

    const results = await analyzer.analyze(CONTEXT);

    expect(results.some(item => item.type === InsightType.CATEGORY_DOMINANCE)).toBe(false);
  });

  it('warns when the savings rate drops by more than the threshold', async () => {
    const analyzer = new FinancialAnalyzer(
      createTransactionRepository({
        monthlyTotals: [
          { income: '1000', spent: '900' }, // 10%
          { income: '1000', spent: '600' }, // 40%
        ],
      }),
      createBudgetRepository([]),
      createNetWorthService(),
    );

    const results = await analyzer.analyze(CONTEXT);
    const savings = results.find(item => item.type === InsightType.SAVINGS_RATE_TREND);

    expect(savings).toMatchObject({
      messageKey: 'trend.savings_rate_down',
      messageParams: { rate: 10, diff: 30 },
      severity: InsightSeverity.WARN,
    });
  });

  it('derives every figure from confirmed transactions only', async () => {
    const transactions = createTransactionRepository({});
    const analyzer = new FinancialAnalyzer(
      transactions,
      createBudgetRepository([]),
      createNetWorthService(),
    );

    await analyzer.analyze(CONTEXT);

    const builder = transactions.createQueryBuilder.mock.results[0].value;
    const confirmedClauses = builder.andWhere.mock.calls.filter(
      ([clause]: [string]) => clause === countedSql('t'),
    );
    // One per query: the category totals and each monthly total.
    expect(transactions.createQueryBuilder.mock.calls.length).toBeGreaterThan(1);
    expect(confirmedClauses).toHaveLength(transactions.createQueryBuilder.mock.calls.length);
  });

  it('reports a rising savings rate as information, not a warning', async () => {
    const analyzer = new FinancialAnalyzer(
      createTransactionRepository({
        monthlyTotals: [
          { income: '1000', spent: '500' }, // 50%
          { income: '1000', spent: '800' }, // 20%
        ],
      }),
      createBudgetRepository([]),
      createNetWorthService(),
    );

    const results = await analyzer.analyze(CONTEXT);
    const savings = results.find(item => item.type === InsightType.SAVINGS_RATE_TREND);

    expect(savings).toMatchObject({
      messageKey: 'trend.savings_rate_up',
      messageParams: { rate: 50, diff: 30 },
      severity: InsightSeverity.INFO,
    });
    const now = new Date();
    expect(savings?.data).toMatchObject({
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    });
  });

  it('stays quiet on a small savings-rate move', async () => {
    const analyzer = new FinancialAnalyzer(
      createTransactionRepository({
        monthlyTotals: [
          { income: '1000', spent: '700' }, // 30%
          { income: '1000', spent: '680' }, // 32%
        ],
      }),
      createBudgetRepository([]),
      createNetWorthService(),
    );

    const results = await analyzer.analyze(CONTEXT);

    expect(results.some(item => item.type === InsightType.SAVINGS_RATE_TREND)).toBe(false);
  });

  it('warns when more than a fifth of capital sits at risk', async () => {
    const analyzer = new FinancialAnalyzer(
      createTransactionRepository({}),
      createBudgetRepository([]),
      createNetWorthService(35),
    );

    const results = await analyzer.analyze(CONTEXT);
    const risky = results.find(item => item.type === InsightType.RISKY_ALLOCATION);

    expect(risky).toMatchObject({
      messageKey: 'pattern.risky_allocation',
      messageParams: { percent: 35, threshold: 20 },
      severity: InsightSeverity.WARN,
    });
  });

  it('stays quiet while the risky share is within the rule', async () => {
    const analyzer = new FinancialAnalyzer(
      createTransactionRepository({}),
      createBudgetRepository([]),
      createNetWorthService(20),
    );

    const results = await analyzer.analyze(CONTEXT);

    expect(results.some(item => item.type === InsightType.RISKY_ALLOCATION)).toBe(false);
  });

  it('says nothing about risk in a workspace that has classified nothing', async () => {
    const analyzer = new FinancialAnalyzer(
      createTransactionRepository({}),
      createBudgetRepository([]),
      createNetWorthService(0),
    );

    const results = await analyzer.analyze(CONTEXT);

    expect(results.some(item => item.type === InsightType.RISKY_ALLOCATION)).toBe(false);
  });

  it('skips the savings rate when a month had no income to take a share of', async () => {
    const analyzer = new FinancialAnalyzer(
      createTransactionRepository({
        monthlyTotals: [
          { income: '0', spent: '400' },
          { income: '1000', spent: '500' },
        ],
      }),
      createBudgetRepository([]),
      createNetWorthService(),
    );

    const results = await analyzer.analyze(CONTEXT);

    expect(results.some(item => item.type === InsightType.SAVINGS_RATE_TREND)).toBe(false);
  });
});
