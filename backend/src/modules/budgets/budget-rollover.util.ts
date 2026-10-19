import { BudgetRolloverMode } from '../../entities/budget.entity';

/**
 * How much a period has to spend once the previous periods are settled.
 *
 * Periods are walked oldest to newest. In `carry` the leftover (or overspend)
 * of one period moves whole into the next. In `refill` the leftover tops the
 * budget back up to the limit and never above it, while an overspend still
 * dents the next period. `none` ignores history.
 */
export function resolveAvailable(
  limit: number,
  mode: BudgetRolloverMode | undefined,
  previousSpent: number[],
): { carriedAmount: number; availableAmount: number } {
  if (!mode || mode === BudgetRolloverMode.NONE) {
    return { carriedAmount: 0, availableAmount: limit };
  }
  let carried = 0;
  for (const spent of previousSpent) {
    const available = availableWith(limit, mode, carried);
    carried = available - spent;
  }
  const availableAmount = availableWith(limit, mode, carried);
  return {
    carriedAmount: round(availableAmount - limit),
    availableAmount: round(availableAmount),
  };
}

function availableWith(limit: number, mode: BudgetRolloverMode, carried: number): number {
  const raw = limit + carried;
  return mode === BudgetRolloverMode.REFILL ? Math.min(limit, raw) : raw;
}

/** Used it all and more: a percentage that can pass 100, or 0 when nothing is available. */
export function percentOf(spent: number, available: number): number {
  if (available > 0) return round((spent / available) * 100);
  return spent > 0 ? 100 : 0;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
