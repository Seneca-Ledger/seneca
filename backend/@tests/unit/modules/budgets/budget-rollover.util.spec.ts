import { BudgetRolloverMode } from '@/entities/budget.entity';
import { percentOf, resolveAvailable } from '@/modules/budgets/budget-rollover.util';

describe('resolveAvailable', () => {
  it('starts every period at the limit without rollover', () => {
    expect(resolveAvailable(100, BudgetRolloverMode.NONE, [20, 150])).toEqual({
      carriedAmount: 0,
      availableAmount: 100,
    });
    expect(resolveAvailable(100, undefined, [20])).toEqual({ carriedAmount: 0, availableAmount: 100 });
  });

  it('carries leftover and overspend whole into the next period', () => {
    // 100 − 30 = 70 left, then 170 − 200 = −30 overspent → 70 available now.
    expect(resolveAvailable(100, BudgetRolloverMode.CARRY, [30, 200])).toEqual({
      carriedAmount: -30,
      availableAmount: 70,
    });
    expect(resolveAvailable(100, BudgetRolloverMode.CARRY, [0, 0])).toEqual({
      carriedAmount: 200,
      availableAmount: 300,
    });
  });

  it('refills up to the limit and never above it, but still deducts overspend', () => {
    expect(resolveAvailable(100, BudgetRolloverMode.REFILL, [0, 0])).toEqual({
      carriedAmount: 0,
      availableAmount: 100,
    });
    expect(resolveAvailable(100, BudgetRolloverMode.REFILL, [130])).toEqual({
      carriedAmount: -30,
      availableAmount: 70,
    });
    // A dent is repaired by the next untouched period.
    expect(resolveAvailable(100, BudgetRolloverMode.REFILL, [130, 0])).toEqual({
      carriedAmount: 0,
      availableAmount: 100,
    });
  });
});

describe('percentOf', () => {
  it('can pass 100 and reads 100 when nothing is available but something was spent', () => {
    expect(percentOf(150, 100)).toBe(150);
    expect(percentOf(10, 0)).toBe(100);
    expect(percentOf(0, 0)).toBe(0);
    expect(percentOf(0, -20)).toBe(0);
  });
});
