import { StoicClass } from '@/entities/category.entity';
import type {
  StoicBalance,
  StoicCategory,
  StoicMonth,
  StoicTotals,
} from '@/modules/budgets/stoic/stoic-ledger.service';
import type { StoicBehavior } from '@/modules/insights/stoic/stoic-behavior.service';

export const totals = (partial: Partial<StoicTotals>): StoicTotals => ({
  necessity: 0,
  work: 0,
  virtue: 0,
  leisure: 0,
  unclassified: 0,
  ...partial,
});

/** Plan: 50 necessity, 20 work, 20 virtue, 10 leisure (percent of 1000). */
export const PLAN = totals({ necessity: 500, work: 200, virtue: 200, leisure: 100 });
/** On plan: exactly the planned shares, a little under the planned total. */
export const onPlan = { necessity: 450, work: 180, virtue: 180, leisure: 90 };
/** Leisure 31% instead of 10%. */
export const leisureHeavy = { necessity: 400, work: 150, virtue: 140, leisure: 310 };

export function month(
  monthsAgo: number,
  actual: Partial<StoicTotals>,
  overrides: Partial<StoicMonth> = {},
): StoicMonth {
  return {
    month: `2026-${String(9 - monthsAgo).padStart(2, '0')}`,
    monthsAgo,
    intended: PLAN,
    actual: totals(actual),
    overBudgetCategoryIds: [],
    spentByCategory: {},
    limitByCategory: {},
    ...overrides,
  };
}

export function category(overrides: Partial<StoicCategory> = {}): StoicCategory {
  return {
    id: 'cat-1',
    name: 'Restaurants',
    parentId: null,
    stoicClass: StoicClass.LEISURE,
    source: 'user',
    spent: 100,
    budgeted: true,
    active: true,
    helpsOthers: false,
    helpsOthersSource: 'suggested',
    ...overrides,
  };
}

export function balance(months: StoicMonth[], categories = [category()]): StoicBalance {
  return { currency: 'EUR', months, categories };
}

export function behavior(overrides: Partial<StoicBehavior> = {}): StoicBehavior {
  return {
    merchants: [],
    previousCounts: {},
    weekendByCategory: {},
    totalByCategory: {},
    cashFlow: [],
    subscriptions: { count: 0, monthlyTotal: 0 },
    ...overrides,
  };
}

/** Late enough in September for the running month to be judged. */
export const SEPT_20 = new Date(2026, 8, 20);
