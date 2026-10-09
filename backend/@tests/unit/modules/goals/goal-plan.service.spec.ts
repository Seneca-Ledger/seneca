import { countedSql } from '@/common/utils/counted-transactions.util';
import { NotFoundException } from '@nestjs/common';
import { BudgetPeriodType } from '@/entities/budget.entity';
import { GoalPlanService } from '@/modules/goals/goal-plan.service';

const WORKSPACE_ID = 'workspace-1';
const GOAL_ID = 'goal-1';

/** Mid-May 2026, so the history window is February through April. */
const NOW = new Date(2026, 4, 8);

interface Options {
  goal?: Record<string, unknown> | null;
  /** Total contributed, and the part of it inside the history window. */
  contributed?: { total: string; inWindow: string };
  budgets?: Array<Record<string, unknown>>;
  income?: Array<{ currency: string; total: string }>;
  estimatedTotal?: number;
  workspaceCurrency?: string;
  rate?: number;
  /** Collects the conditions the income query was given. */
  incomeClauses?: string[];
}

function createService(options: Options) {
  const goalRepository = {
    findOne: jest.fn(async () => options.goal ?? null),
  } as never;

  // Two calls: the lifetime total first, then the windowed one. They are told
  // apart by whether the caller narrowed the query by date.
  const contributionRepository = {
    createQueryBuilder: jest.fn(() => {
      let windowed = false;
      const builder: Record<string, unknown> = {
        select: jest.fn(() => builder),
        where: jest.fn(() => builder),
        andWhere: jest.fn((clause: string) => {
          if (clause.includes('contribution_date')) {
            windowed = true;
          }
          return builder;
        }),
        getRawOne: jest.fn(async () => ({
          total: windowed
            ? (options.contributed?.inWindow ?? '0')
            : (options.contributed?.total ?? '0'),
        })),
      };
      return builder;
    }),
  } as never;

  const transactionRepository = {
    createQueryBuilder: jest.fn(() => {
      const builder: Record<string, unknown> = {
        select: jest.fn(() => builder),
        addSelect: jest.fn(() => builder),
        where: jest.fn(() => builder),
        andWhere: jest.fn((clause: string) => {
          options.incomeClauses?.push(clause);
          return builder;
        }),
        groupBy: jest.fn(() => builder),
        getRawMany: jest.fn(async () => options.income ?? []),
      };
      return builder;
    }),
  } as never;

  const budgetRepository = {
    find: jest.fn(async () => options.budgets ?? []),
  } as never;

  const workspaceRepository = {
    findOne: jest.fn(async () => ({ currency: options.workspaceCurrency ?? 'KZT' })),
  } as never;

  const goalItemsService = {
    estimatedTotal: jest.fn(async () => options.estimatedTotal ?? 0),
  } as never;

  const exchangeRatesService = { getRate: jest.fn(async () => options.rate ?? 1) } as never;

  return new GoalPlanService(
    goalRepository,
    contributionRepository,
    budgetRepository,
    transactionRepository,
    workspaceRepository,
    goalItemsService,
    exchangeRatesService,
  );
}

const relocation = {
  id: GOAL_ID,
  name: 'Relocation',
  targetAmount: '3000000',
  currency: 'KZT',
  targetDate: '2026-12-31',
  // Old enough that the full three-month history counts.
  createdAt: new Date(2025, 0, 1),
};

describe('GoalPlanService', () => {
  it('rejects a goal from another workspace', async () => {
    const service = createService({ goal: null });
    await expect(service.getPlan(GOAL_ID, WORKSPACE_ID, NOW)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('splits the remaining amount over the months left, counting the current one', async () => {
    const service = createService({
      goal: relocation,
      contributed: { total: '1200000', inWindow: '0' },
    });

    const plan = await service.getPlan(GOAL_ID, WORKSPACE_ID, NOW);

    // May through December is eight months, and 1.8M is left.
    expect(plan.monthsLeft).toBe(8);
    expect(plan.remaining).toBe(1800000);
    expect(plan.requiredPerMonth).toBe(225000);
  });

  it('demands the whole remainder at once when the date has passed', async () => {
    const service = createService({
      goal: { ...relocation, targetDate: '2026-03-01' },
      contributed: { total: '1000000', inWindow: '0' },
    });

    const plan = await service.getPlan(GOAL_ID, WORKSPACE_ID, NOW);

    expect(plan.monthsLeft).toBe(0);
    expect(plan.requiredPerMonth).toBe(2000000);
  });

  it('averages the pace over the completed history months', async () => {
    const service = createService({
      goal: relocation,
      contributed: { total: '1200000', inWindow: '900000' },
    });

    const plan = await service.getPlan(GOAL_ID, WORKSPACE_ID, NOW);

    expect(plan.pace).toEqual({ perMonth: 300000, monthsObserved: 3 });
    // 1.8M left at 300k a month is six months, so it lands in October — two
    // months ahead of the December target.
    expect(plan.forecast).toEqual({ month: '2026-10', monthsLate: 0 });
  });

  it('reports no pace for a goal younger than a complete month', async () => {
    const service = createService({
      goal: { ...relocation, createdAt: new Date(2026, 4, 2) },
      contributed: { total: '100000', inWindow: '0' },
    });

    const plan = await service.getPlan(GOAL_ID, WORKSPACE_ID, NOW);

    expect(plan.pace).toEqual({ perMonth: 0, monthsObserved: 0 });
    // Nothing observed yet, so there is no arrival date to name.
    expect(plan.forecast.month).toBeNull();
  });

  it('forecasts a late arrival when the pace is below what the date needs', async () => {
    const service = createService({
      goal: relocation,
      contributed: { total: '1200000', inWindow: '300000' },
    });

    const plan = await service.getPlan(GOAL_ID, WORKSPACE_ID, NOW);

    expect(plan.pace.perMonth).toBe(100000);
    // 18 months at 100k a month, against the 8 the target date allows.
    expect(plan.forecast).toEqual({ month: '2027-10', monthsLate: 10 });
  });

  it('measures free cash flow as income less every active budget', async () => {
    const service = createService({
      goal: relocation,
      contributed: { total: '1200000', inWindow: '0' },
      income: [{ currency: 'KZT', total: '2400000' }],
      budgets: [
        {
          limitAmount: '400000',
          currency: 'KZT',
          periodType: BudgetPeriodType.MONTHLY,
          startsOn: null,
          endsOn: null,
        },
        {
          limitAmount: '1200000',
          currency: 'KZT',
          periodType: BudgetPeriodType.QUARTERLY,
          startsOn: null,
          endsOn: null,
        },
      ],
    });

    const plan = await service.getPlan(GOAL_ID, WORKSPACE_ID, NOW);

    // 2.4M over three months is 800k a month; 400k monthly plus a 1.2M quarter
    // normalised to 400k is 800k committed.
    expect(plan.capacity).toEqual({ income: 800000, committed: 800000, free: 0 });
    expect(plan.status).toBe('not_feasible');
  });

  it('reads income from confirmed transactions only', async () => {
    const incomeClauses: string[] = [];
    const service = createService({
      goal: relocation,
      contributed: { total: '0', inWindow: '0' },
      income: [{ currency: 'KZT', total: '2400000' }],
      incomeClauses,
    });

    await service.getPlan(GOAL_ID, WORKSPACE_ID, NOW);

    expect(incomeClauses).toContain(countedSql('t'));
  });

  it('ignores a budget whose window has closed', async () => {
    const service = createService({
      goal: relocation,
      contributed: { total: '1200000', inWindow: '0' },
      income: [{ currency: 'KZT', total: '2400000' }],
      budgets: [
        {
          limitAmount: '500000',
          currency: 'KZT',
          periodType: BudgetPeriodType.MONTHLY,
          startsOn: '2026-01-01',
          endsOn: '2026-03-31',
        },
      ],
    });

    const plan = await service.getPlan(GOAL_ID, WORKSPACE_ID, NOW);

    expect(plan.capacity.committed).toBe(0);
    expect(plan.capacity.free).toBe(800000);
  });

  it('calls the plan tight when the required amount eats most of the free cash', async () => {
    const service = createService({
      goal: { ...relocation, targetAmount: '1000000' },
      contributed: { total: '0', inWindow: '0' },
      income: [{ currency: 'KZT', total: '450000' }],
    });

    const plan = await service.getPlan(GOAL_ID, WORKSPACE_ID, NOW);

    // 125k a month required against 150k free: inside the budget, but only just.
    expect(plan.requiredPerMonth).toBe(125000);
    expect(plan.capacity.free).toBe(150000);
    expect(plan.status).toBe('tight');
  });

  it('has no verdict to give without a target date', async () => {
    const service = createService({
      goal: { ...relocation, targetDate: null },
      contributed: { total: '1000000', inWindow: '0' },
    });

    const plan = await service.getPlan(GOAL_ID, WORKSPACE_ID, NOW);

    expect(plan.monthsLeft).toBeNull();
    expect(plan.requiredPerMonth).toBeNull();
    expect(plan.gap).toBeNull();
    expect(plan.status).toBe('no_deadline');
  });

  it('surfaces an estimate that has outgrown the declared target', async () => {
    const service = createService({
      goal: relocation,
      contributed: { total: '0', inWindow: '0' },
      estimatedTotal: 3400000,
    });

    const plan = await service.getPlan(GOAL_ID, WORKSPACE_ID, NOW);

    expect(plan.target).toEqual({
      declared: 3000000,
      estimated: 3400000,
      unallocated: -400000,
    });
  });

  it('converts the goal into the workspace currency', async () => {
    const service = createService({
      goal: { ...relocation, currency: 'EUR', targetAmount: '10000' },
      contributed: { total: '2000', inWindow: '0' },
      workspaceCurrency: 'KZT',
      // A fixed rate is enough: what matters is that the conversion reaches the
      // target and the savings alike, so the remainder stays coherent.
      rate: 500,
    });

    const plan = await service.getPlan(GOAL_ID, WORKSPACE_ID, NOW);

    expect(plan.currency).toBe('KZT');
    expect(plan.saved).toBe(1000000);
    expect(plan.remaining).toBe(4000000);
  });

  it('reports a reached goal as reached rather than judging its feasibility', async () => {
    const service = createService({
      goal: relocation,
      contributed: { total: '3000000', inWindow: '0' },
    });

    const plan = await service.getPlan(GOAL_ID, WORKSPACE_ID, NOW);

    expect(plan.remaining).toBe(0);
    expect(plan.status).toBe('reached');
  });
});
