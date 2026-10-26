import {
  allocateWithinLimit,
  type WithinLimitBudget,
  type WithinLimitRow,
} from '../../../../src/modules/budgets/budget-within-limit.util';

const GROCERIES = 'cat-groceries';
const FOOD = 'cat-food';
const CAFE = 'cat-cafe';
const parentOf = new Map<string, string | null>([
  [FOOD, null],
  [GROCERIES, FOOD],
  [CAFE, null],
]);

const october = { start: '2026-10-01', end: '2026-10-31' };

const budget = (
  id: string,
  categoryId: string,
  remaining: number,
  overrides: Partial<WithinLimitBudget> = {},
): WithinLimitBudget => ({
  id,
  categoryId,
  categoryIds: categoryId === FOOD ? [FOOD, GROCERIES] : [categoryId],
  periods: [{ ...october, remaining }],
  ...overrides,
});

/** A EUR row; every budget sees it at face value unless `inBudget` says otherwise. */
const row = (
  date: string,
  categoryId: string,
  amount: number,
  inBudget: Record<string, number | null> = {},
  budgetIds: string[] = ['groceries', 'food', 'cafe'],
): WithinLimitRow => ({
  transactionId: `${date}-${categoryId}-${amount}`,
  date,
  categoryId,
  currency: 'EUR',
  amount,
  inBudgetCurrency: new Map(budgetIds.map(id => [id, id in inBudget ? inBudget[id] : amount])),
});

const byDate = (result: ReturnType<typeof allocateWithinLimit>) =>
  Object.fromEntries(result.map(entry => [entry.date, entry.amount]));

describe('allocateWithinLimit', () => {
  it('counts spending as budgeted up to the limit and none of it past the limit', () => {
    const limit = 100;
    const result = allocateWithinLimit(
      [budget('groceries', GROCERIES, limit)],
      [
        row('2026-10-03', GROCERIES, 60),
        row('2026-10-09', GROCERIES, 70),
        row('2026-10-12', GROCERIES, 20),
      ],
      parentOf,
    );

    expect(byDate(result)).toEqual({ '2026-10-03': 60, '2026-10-09': limit - 60 });
  });

  it('leaves spending in a category without a budget out', () => {
    const result = allocateWithinLimit(
      [budget('groceries', GROCERIES, 100)],
      [row('2026-10-05', CAFE, 12)],
      parentOf,
    );

    expect(result).toEqual([]);
  });

  it('starts from the room the period has left before the first row', () => {
    // A quarterly budget of 300 that spent 280 in August and September.
    const remaining = 300 - 280;
    const result = allocateWithinLimit(
      [budget('groceries', GROCERIES, remaining, { periods: [{ start: '2026-10-01', end: '2026-12-31', remaining }] })],
      [row('2026-10-02', GROCERIES, 50)],
      parentOf,
    );

    expect(byDate(result)).toEqual({ '2026-10-02': remaining });
  });

  it('judges a row by its own category budget, which still uses up the parent budget', () => {
    const result = allocateWithinLimit(
      [budget('groceries', GROCERIES, 100), budget('food', FOOD, 120)],
      [
        // Groceries goes 50 over its own limit: the parent's room does not make that budgeted.
        row('2026-10-04', GROCERIES, 150),
        // Food had 120 and the groceries row took 150 of it: nothing left.
        row('2026-10-06', FOOD, 30),
      ],
      parentOf,
    );

    expect(byDate(result)).toEqual({ '2026-10-04': 100 });
  });

  it('falls back to the parent budget for a subcategory with none of its own', () => {
    const result = allocateWithinLimit(
      [budget('food', FOOD, 80)],
      [row('2026-10-04', GROCERIES, 50), row('2026-10-05', GROCERIES, 50)],
      parentOf,
    );

    expect(byDate(result)).toEqual({ '2026-10-04': 50, '2026-10-05': 30 });
  });

  it('does not count a row with no rate to the budget currency', () => {
    const result = allocateWithinLimit(
      [budget('groceries', GROCERIES, 100)],
      [row('2026-10-04', GROCERIES, 40, { groceries: null })],
      parentOf,
    );

    expect(result).toEqual([]);
  });

  it('measures room in the budget currency and answers in the row currency', () => {
    // 40 EUR is 80 in the budget's currency, of which 60 fit: three quarters of the row.
    const result = allocateWithinLimit(
      [budget('groceries', GROCERIES, 60)],
      [row('2026-10-04', GROCERIES, 40, { groceries: 80 })],
      parentOf,
    );

    expect(result).toEqual([
      { transactionId: `2026-10-04-${GROCERIES}-40`, date: '2026-10-04', currency: 'EUR', amount: 30 },
    ]);
  });

  it('stops counting after the budget window ends', () => {
    const result = allocateWithinLimit(
      [budget('groceries', GROCERIES, 100, { periods: [{ start: '2026-10-01', end: '2026-10-15', remaining: 100 }] })],
      [row('2026-10-10', GROCERIES, 10), row('2026-10-20', GROCERIES, 10)],
      parentOf,
    );

    expect(byDate(result)).toEqual({ '2026-10-10': 10 });
  });

  it('refills a weekly budget at the start of the next week', () => {
    const weekly = budget('groceries', GROCERIES, 0, {
      periods: [
        { start: '2026-09-28', end: '2026-10-04', remaining: 25 },
        { start: '2026-10-05', end: '2026-10-11', remaining: 25 },
      ],
    });
    const result = allocateWithinLimit(
      [weekly],
      [row('2026-10-03', GROCERIES, 40), row('2026-10-06', GROCERIES, 40)],
      parentOf,
    );

    expect(byDate(result)).toEqual({ '2026-10-03': 25, '2026-10-06': 25 });
  });
});
