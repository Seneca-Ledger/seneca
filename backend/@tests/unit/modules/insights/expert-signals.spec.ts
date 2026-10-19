import { StoicClass } from '@/entities/category.entity';
import { collectExpertSignals } from '@/modules/insights/stoic/expert-signals';
import type { StoicContext } from '@/modules/insights/stoic/stoic-signals';
import { balance, behavior, category, month, onPlan, SEPT_20 } from './stoic-fixtures';

/** Judged month is September; finished months start at August. */
const flow = (months: Array<[number, number]>) => [
  { month: '2026-09', income: 0, expense: 0 },
  ...months.map(([income, expense], index) => ({
    month: `2026-${String(8 - index).padStart(2, '0')}`,
    income,
    expense,
  })),
];

function context(overrides: Partial<StoicContext> = {}): StoicContext {
  return {
    now: SEPT_20,
    balance: balance([month(0, onPlan)]),
    behavior: behavior({
      cashFlow: flow([
        [4000, 3000],
        [4000, 3000],
        [4000, 3000],
      ]),
    }),
    goals: [],
    commitments: null,
    ...overrides,
  };
}

const find = (overrides: Partial<StoicContext>, key: string) =>
  collectExpertSignals(context(overrides)).find(signal => signal.key === key);

describe('Expert principles', () => {
  it('says nothing without at least two finished months of income', () => {
    expect(
      collectExpertSignals(context({ behavior: behavior({ cashFlow: flow([[4000, 3000]]) }) })),
    ).toEqual([]);
  });

  it('asks to pay yourself first when less than a tenth is kept', () => {
    const signal = find(
      {
        behavior: behavior({
          cashFlow: flow([
            [4000, 3800],
            [4000, 3700],
            [4000, 3900],
          ]),
        }),
      },
      'expert.pay_yourself_first',
    );
    expect(signal?.params).toEqual({ savingsPercent: 5, tenthAmount: 400, months: 3 });
    expect(signal?.data).toMatchObject({ expert: 'George S. Clason', target: 'goals' });
  });

  it('holds income against 50/30/20 when must-haves take too much', () => {
    const heavyNeeds = balance([
      month(0, onPlan),
      month(1, { necessity: 2600, leisure: 400 }),
      month(2, { necessity: 2600, leisure: 400 }),
      month(3, { necessity: 2600, leisure: 400 }),
    ]);
    expect(find({ balance: heavyNeeds }, 'expert.rule_50_30_20')?.params).toEqual({
      needsPercent: 65,
      wantsPercent: 10,
      savingsPercent: 25,
    });
  });

  it('measures the cushion in days of spending', () => {
    expect(
      find(
        {
          commitments: {
            openingBalance: 4500,
            shortfallDate: null,
            lowestBalance: 0,
            totalCommitted: 0,
          },
        },
        'expert.room_for_error',
      )?.params,
    ).toEqual({ cushionDays: 45, targetAmount: 9000 });
    expect(
      find(
        {
          commitments: {
            openingBalance: 12000,
            shortfallDate: null,
            lowestBalance: 0,
            totalCommitted: 0,
          },
        },
        'expert.room_for_error',
      ),
    ).toBeUndefined();
  });

  it('notices spending growing faster than income across two quarters', () => {
    const creeping = behavior({
      cashFlow: flow([
        [4000, 3300],
        [4000, 3300],
        [4000, 3300],
        [4000, 2800],
        [4000, 2800],
        [4000, 2800],
      ]),
    });
    expect(find({ behavior: creeping }, 'expert.lifestyle_creep')?.params).toEqual({
      expenseGrowth: 18,
      incomeGrowth: 0,
    });
  });

  it('prices a leisure merchant in hours of work', () => {
    const signal = find(
      {
        balance: balance(
          [month(0, onPlan)],
          [category({ id: 'fun', stoicClass: StoicClass.LEISURE })],
        ),
        behavior: behavior({
          cashFlow: flow([
            [4000, 3000],
            [4000, 3000],
            [4000, 3000],
          ]),
          merchants: [{ name: 'Steam', categoryId: 'fun', count: 2, total: 250 }],
        }),
      },
      'expert.life_energy',
    );
    // 4000 a month over 160 hours is 25 an hour; 250 is ten hours.
    expect(signal?.params).toEqual({ merchant: 'Steam', totalAmount: 250, hours: 10 });
  });
});
