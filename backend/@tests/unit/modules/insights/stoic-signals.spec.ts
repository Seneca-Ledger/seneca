import { StoicClass } from '@/entities/category.entity';
import {
  collectSignals,
  type StoicContext,
  type StoicGoalView,
} from '@/modules/insights/stoic/stoic-signals';
import {
  balance,
  behavior,
  category,
  leisureHeavy,
  month,
  onPlan,
  SEPT_20,
  totals,
} from './stoic-fixtures';

function signals(overrides: Partial<StoicContext>) {
  return collectSignals({
    now: SEPT_20,
    balance: balance([month(0, onPlan)]),
    behavior: null,
    goals: [],
    commitments: null,
    ...overrides,
  });
}

const keys = (overrides: Partial<StoicContext>) => signals(overrides).map(signal => signal.key);
const find = (overrides: Partial<StoicContext>, key: string) =>
  signals(overrides).find(signal => signal.key === key);

describe('Stoic signals — plan against reality', () => {
  it('stays quiet on a small drift in leisure', () => {
    // Leisure 15% against 10% planned: five points, under the threshold.
    expect(
      keys({
        balance: balance([month(0, { necessity: 450, work: 200, virtue: 200, leisure: 150 })]),
      }),
    ).not.toContain('stoic.leisure_over_plan');
  });

  it('calls leisure over plan in three of the last months a habit', () => {
    const habit = find(
      {
        balance: balance([
          month(0, leisureHeavy),
          month(1, onPlan),
          month(2, leisureHeavy),
          month(3, leisureHeavy),
          month(4, onPlan),
        ]),
      },
      'stoic.leisure_habit',
    );
    expect(habit?.params).toEqual({ months: 3, window: 5 });
  });

  it('calls virtue postponed two months running neglect', () => {
    const lowVirtue = { necessity: 500, work: 200, virtue: 40, leisure: 100 };
    expect(
      find(
        { balance: balance([month(0, lowVirtue), month(1, lowVirtue), month(2, onPlan)]) },
        'stoic.virtue_neglected',
      )?.params,
    ).toEqual({ months: 2 });
  });

  it('names a category that keeps breaking its limit', () => {
    const over = { overBudgetCategoryIds: ['cat-1'] };
    const signal = find(
      {
        balance: balance([
          month(0, onPlan, over),
          month(1, onPlan, over),
          month(2, onPlan),
          month(3, onPlan, over),
        ]),
      },
      'stoic.repeated_overrun',
    );
    expect(signal?.params).toEqual({ category: 'Restaurants', months: 3, window: 4 });
    expect(signal?.data).toEqual({ categoryId: 'cat-1' });
  });

  it('says how far the whole month went past the plan', () => {
    expect(
      find(
        { balance: balance([month(0, { necessity: 800, work: 200, virtue: 150, leisure: 50 })]) },
        'stoic.total_over_plan',
      )?.params,
    ).toEqual({ percent: 20, spentAmount: 1200, plannedAmount: 1000 });
  });

  it('notices necessities outgrowing their share', () => {
    const found = keys({
      balance: balance([month(0, { necessity: 900, work: 200, virtue: 200, leisure: 100 })]),
    });
    expect(found).toContain('stoic.necessity_over_plan');
  });

  it('does not call a class over plan when nothing was planned for it', () => {
    const noNecessity = totals({ work: 500, virtue: 300, leisure: 200 });
    expect(keys({ balance: balance([month(0, onPlan, { intended: noNecessity })]) })).not.toContain(
      'stoic.necessity_over_plan',
    );
  });

  it('notices a plan with no room for virtue', () => {
    const noVirtue = totals({ necessity: 600, work: 300, leisure: 100 });
    expect(keys({ balance: balance([month(0, onPlan, { intended: noVirtue })]) })).toContain(
      'stoic.virtue_absent_plan',
    );
  });

  it('measures how much spending no budget watches', () => {
    const signal = find(
      {
        balance: balance([
          month(0, onPlan, {
            spentByCategory: { a: 500, b: 400 },
            limitByCategory: { a: 600 },
          }),
        ]),
      },
      'stoic.unbudgeted_share',
    );
    expect(signal?.params).toEqual({ percent: 44, unbudgetedAmount: 400 });
  });

  it('warns early when a budget will not last the month', () => {
    // Day 10 of 30: 450 of a 600 limit spent → runs out on day 14.
    const signal = find(
      {
        now: new Date(2026, 8, 10),
        balance: balance([
          month(0, onPlan, {
            spentByCategory: { 'cat-1': 450 },
            limitByCategory: { 'cat-1': 600 },
          }),
        ]),
      },
      'stoic.budget_pace',
    );
    expect(signal?.params).toEqual({
      category: 'Restaurants',
      day: 14,
      limitAmount: 600,
      spentAmount: 450,
    });
  });

  it('does not judge the pace in the first week', () => {
    expect(
      keys({
        now: new Date(2026, 8, 5),
        balance: balance([
          month(0, onPlan, {
            spentByCategory: { 'cat-1': 450 },
            limitByCategory: { 'cat-1': 600 },
          }),
        ]),
      }),
    ).not.toContain('stoic.budget_pace');
  });

  it('points at a budget nothing has been spent from for months', () => {
    const idle = { limitByCategory: { 'cat-1': 100 }, spentByCategory: {} };
    expect(
      find(
        { balance: balance([month(0, onPlan), month(1, onPlan, idle), month(2, onPlan, idle)]) },
        'stoic.budget_unused',
      )?.params,
    ).toEqual({ category: 'Restaurants', months: 2 });
  });

  it('tells necessities creeping up from necessities holding steady', () => {
    const withNecessity = (values: number[]) =>
      balance([
        month(0, onPlan),
        ...values.map((necessity, index) => month(index + 1, { ...onPlan, necessity })),
      ]);
    expect(
      find({ balance: withNecessity([600, 520, 450]) }, 'stoic.necessity_creep')?.params,
    ).toEqual({ months: 3, percent: 33 });
    expect(keys({ balance: withNecessity([452, 450, 449]) })).toContain(
      'stoic.praise_necessity_stable',
    );
  });

  it('withholds plan praise from a month over its total plan', () => {
    expect(
      signals({
        balance: balance([month(0, { necessity: 800, work: 200, virtue: 150, leisure: 50 })]),
      }).filter(signal => signal.praise && signal.key !== 'stoic.praise_necessity_stable'),
    ).toEqual([]);
  });

  it('offers several reasons for praise when they are all true', () => {
    const praise = signals({
      balance: balance([month(0, onPlan), month(1, onPlan)]),
    }).filter(signal => signal.praise);
    expect(praise.map(signal => signal.key)).toEqual(
      expect.arrayContaining(['stoic.praise_within_plan', 'stoic.praise_virtue']),
    );
  });

  it('praises being under plan only once the month is finished', () => {
    const light = { necessity: 350, work: 150, virtue: 200, leisure: 50 };
    expect(keys({ balance: balance([month(0, light)]) })).not.toContain('stoic.praise_under_plan');
    expect(
      find(
        { now: new Date(2026, 8, 3), balance: balance([month(0, {}), month(1, light)]) },
        'stoic.praise_under_plan',
      )?.params,
    ).toEqual({ percent: 25, savedAmount: 250 });
  });

  it('says nothing about a month with no plan to judge it by', () => {
    expect(
      signals({ balance: balance([month(0, leisureHeavy, { intended: totals({}) })]) }),
    ).toEqual([]);
  });

  it('asks the user to judge categories nobody has classified yet', () => {
    const signal = find(
      {
        balance: balance(
          [month(0, onPlan)],
          [
            category(),
            category({ id: 'cat-2', name: 'Misc', stoicClass: null, source: null }),
            category({ id: 'cat-3', stoicClass: null, source: null, active: false }),
          ],
        ),
      },
      'stoic.unclassified',
    );
    expect(signal?.params).toEqual({ count: 1 });
  });
});

describe('Stoic signals — behaviour', () => {
  const leisureCategories = [
    category(),
    category({ id: 'cat-2', name: 'Cinema' }),
    category({ id: 'food', name: 'Groceries', stoicClass: StoicClass.NECESSITY }),
  ];
  const withBehavior = (overrides: Parameters<typeof behavior>[0], monthOverrides = {}) => ({
    balance: balance([month(0, onPlan, monthOverrides)], leisureCategories),
    behavior: behavior({ totalByCategory: { 'cat-1': 300, food: 700 }, ...overrides }),
  });

  it('counts small repeated purchases at one leisure merchant', () => {
    const signal = find(
      withBehavior({
        merchants: [{ name: 'Coffee Bar', categoryId: 'cat-1', count: 12, total: 54 }],
      }),
      'stoic.small_purchases',
    );
    expect(signal?.params).toEqual({ merchant: 'Coffee Bar', count: 12, totalAmount: 54 });
  });

  it('does not call frequent grocery shopping a habit to fix', () => {
    expect(
      keys(
        withBehavior({
          merchants: [{ name: 'Lidl', categoryId: 'food', count: 14, total: 280 }],
        }),
      ),
    ).not.toContain('stoic.small_purchases');
  });

  it('praises fewer small purchases than the month before, scaled to the days so far', () => {
    const signal = find(
      withBehavior({
        merchants: [{ name: 'Coffee Bar', categoryId: 'cat-1', count: 2, total: 9 }],
        previousCounts: { 'Coffee Bar': 12 },
      }),
      'stoic.praise_fewer_small',
    );
    expect(signal?.params).toEqual({ merchant: 'Coffee Bar', before: 12, after: 3 });
  });

  it('notices leisure that lives on weekends', () => {
    expect(
      find(withBehavior({ weekendByCategory: { 'cat-1': 240 } }), 'stoic.weekend_leisure')?.params,
    ).toEqual({ percent: 80 });
  });

  it('notices one leisure merchant taking a large share of the month', () => {
    expect(
      find(
        withBehavior({
          merchants: [{ name: 'Steam', categoryId: 'cat-1', count: 3, total: 250 }],
        }),
        'stoic.top_merchant',
      )?.params,
    ).toEqual({ merchant: 'Steam', percent: 25, totalAmount: 250 });
  });

  it('notices one category holding most of the leisure', () => {
    expect(
      find(
        withBehavior({}, { spentByCategory: { 'cat-1': 270, 'cat-2': 30 } }),
        'stoic.leisure_concentration',
      )?.params,
    ).toEqual({ category: 'Restaurants', percent: 90 });
  });

  const flow = (last: [number, number]) => [
    { month: '2026-09', income: 100, expense: 100 },
    { month: '2026-08', income: last[0], expense: last[1] },
    { month: '2026-07', income: 5000, expense: 3000 },
    { month: '2026-06', income: 5000, expense: 3000 },
    { month: '2026-05', income: 5000, expense: 3000 },
  ];

  it('says so when income fell and spending did not follow', () => {
    expect(
      find(withBehavior({ cashFlow: flow([3500, 3100]) }), 'stoic.income_drop')?.params,
    ).toEqual({
      percent: 30,
      incomeAmount: 3500,
      expenseAmount: 3100,
    });
  });

  it('praises spending that followed income down', () => {
    expect(
      find(withBehavior({ cashFlow: flow([3500, 2400]) }), 'stoic.praise_income_adapted')?.params,
    ).toEqual({ incomePercent: 30, expensePercent: 20 });
  });

  it('weighs subscriptions against a normal month of spending', () => {
    expect(
      find(
        withBehavior({
          cashFlow: flow([5000, 3000]),
          subscriptions: { count: 6, monthlyTotal: 420 },
        }),
        'stoic.subscriptions_share',
      )?.params,
    ).toEqual({ count: 6, percent: 14, monthlyAmount: 420 });
  });
});

describe('Stoic signals — generosity', () => {
  const charity = category({
    id: 'charity',
    name: 'Charity',
    stoicClass: StoicClass.VIRTUE,
    helpsOthers: true,
  });
  // Judged month is September; the window is the three finished months before it.
  const flow = [
    { month: '2026-09', income: 0, expense: 0 },
    { month: '2026-08', income: 5000, expense: 3000 },
    { month: '2026-07', income: 5000, expense: 3000 },
    { month: '2026-06', income: 5000, expense: 3000 },
  ];
  const withGiving = (given: number) => ({
    balance: balance(
      [
        month(0, onPlan),
        month(1, onPlan, { spentByCategory: { charity: given } }),
        month(2, onPlan),
        month(3, onPlan),
      ],
      [category(), charity],
    ),
    behavior: behavior({ cashFlow: flow }),
  });

  it('gently notes earning well while giving almost nothing', () => {
    const signal = find(withGiving(0), 'stoic.generosity_gap');
    expect(signal?.params).toEqual({
      savingsPercent: 40,
      incomeAmount: 15000,
      givenAmount: 0,
      months: 3,
    });
    // Soft enough to sit next to praise for everything else.
    expect(signal?.priority).toBeLessThan(40);
  });

  it('praises giving a real share of income', () => {
    expect(find(withGiving(450), 'stoic.praise_generosity')?.params).toEqual({
      percent: 3,
      givenAmount: 450,
      months: 3,
    });
    expect(keys(withGiving(450))).not.toContain('stoic.generosity_gap');
  });

  it('does not ask someone who is barely getting by to give more', () => {
    const tight = withGiving(0);
    tight.behavior = behavior({
      cashFlow: flow.map(item => ({ ...item, expense: item.income * 0.95 })),
    });
    expect(keys(tight)).not.toContain('stoic.generosity_gap');
  });
});

describe('Stoic signals — goals and commitments', () => {
  const goal = (overrides: Partial<StoicGoalView>): StoicGoalView => ({
    id: 'g1',
    name: 'Lisbon',
    percent: 40,
    status: 'on_track',
    requiredPerMonth: 300,
    pacePerMonth: 300,
    monthsLate: 0,
    freePerMonth: 900,
    ...overrides,
  });

  it('prefers the goal that cannot fit over one that is merely late', () => {
    const signal = find(
      {
        goals: [
          goal({ id: 'late', monthsLate: 2, pacePerMonth: 150 }),
          goal({ id: 'g2', name: 'House', status: 'not_feasible', requiredPerMonth: 1200 }),
        ],
      },
      'stoic.goal_not_feasible',
    );
    expect(signal?.params).toEqual({ goal: 'House', requiredAmount: 1200, freeAmount: 900 });
    expect(keys({ goals: [goal({ status: 'not_feasible' })] })).not.toContain('stoic.goal_behind');
  });

  it('says how late a goal will be at the current pace', () => {
    expect(
      find({ goals: [goal({ monthsLate: 2, pacePerMonth: 150 })] }, 'stoic.goal_behind')?.params,
    ).toEqual({ goal: 'Lisbon', requiredAmount: 300, paceAmount: 150, monthsLate: 2 });
  });

  it('praises a goal on schedule', () => {
    expect(find({ goals: [goal({})] }, 'stoic.praise_goal_on_track')?.params).toEqual({
      goal: 'Lisbon',
      percent: 40,
    });
  });

  it('foresees the day the balance goes below zero', () => {
    expect(
      find(
        {
          commitments: { shortfallDate: '2026-10-05', lowestBalance: -250.4, totalCommitted: 1800 },
        },
        'stoic.shortfall',
      )?.params,
    ).toEqual({ date: '2026-10-05', lowestAmount: -250, committedAmount: 1800 });
  });

  it('works without any budgets at all', () => {
    const found = keys({
      balance: balance([month(0, onPlan, { intended: totals({}) })]),
      goals: [goal({ monthsLate: 1 })],
      commitments: { shortfallDate: '2026-10-05', lowestBalance: -1, totalCommitted: 10 },
    });
    expect(found).toEqual(expect.arrayContaining(['stoic.goal_behind', 'stoic.shortfall']));
  });
});
