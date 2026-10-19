import { describe, expect, it } from 'vitest';
import {
  buildBudgetUpdatePayload,
  normalizeBudgetItem,
  toNonNegativeNumber,
} from './useBudgetsPage';
import type { BudgetItem } from './useBudgetsPage';

describe('budget number normalization', () => {
  it('keeps decimal strings from the API as usable numbers', () => {
    expect(toNonNegativeNumber('1250.50')).toBe(1250.5);
    expect(toNonNegativeNumber('')).toBe(0);
    expect(toNonNegativeNumber(null)).toBe(0);
  });

  it('normalizes budget API decimal fields before form editing and summaries', () => {
    const budget = normalizeBudgetItem({
      id: 'budget-1',
      name: 'Rent',
      categoryId: 'category-1',
      limitAmount: '1000.00' as unknown as number,
      limitAmountWorkspace: '1000.00' as unknown as number,
      manualSpentAmount: '24.00' as unknown as number,
      currency: 'USD',
      workspaceCurrency: 'USD',
      periodType: 'monthly',
      goalId: '',
      spentAmount: '24.00' as unknown as number,
      percentUsed: '2.40' as unknown as number,
      createdAt: '2026-05-09T00:00:00.000Z',
    } satisfies BudgetItem);

    expect(budget.limitAmount).toBe(1000);
    expect(budget.limitAmountWorkspace).toBe(1000);
    expect(budget.manualSpentAmount).toBe(24);
    expect(budget.spentAmount).toBe(24);
    expect(budget.percentUsed).toBe(2.4);
  });

  it('updates spending without resending the budget limit', () => {
    const payload = buildBudgetUpdatePayload(
      {
        name: 'Rent',
        categoryId: 'category-1',
        limitAmount: 1000,
        manualSpentAmount: 24,
        currency: 'USD',
        periodType: 'monthly',
        rolloverMode: 'none',
        goalId: '',
        startsOn: '',
        endsOn: '',
      },
      'spending',
    );

    expect(payload).toEqual({ manualSpentAmount: 24 });
  });

  // A project budget without its window is just an ordinary one, so the dates
  // have to survive the trip from the form to the request body.
  it('carries the budget window on a full edit', () => {
    const payload = buildBudgetUpdatePayload(
      {
        name: 'Moving costs',
        categoryId: 'category-1',
        limitAmount: 300000,
        manualSpentAmount: 0,
        currency: 'KZT',
        periodType: 'monthly',
        rolloverMode: 'none',
        goalId: 'goal-1',
        startsOn: '2026-02-01',
        endsOn: '2026-08-31',
      },
      'edit',
    );

    expect(payload).toEqual(
      expect.objectContaining({ startsOn: '2026-02-01', endsOn: '2026-08-31' }),
    );
  });
});
