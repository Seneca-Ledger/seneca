import type { BudgetPeriodType } from '../../entities/budget.entity';
import { normalizeLimitToMonth } from '../budgets/budget-period.util';

/** Days in the calendar month that `year`/`month` (1-based) names. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * How many months a window covers, counting a partial month as the share of its
 * own days — three whole months are exactly 3, and half of April is 0.5.
 *
 * Measured per calendar month rather than as days / 30.44, so a quarter of
 * whole months never comes out as 2.96 and nobody has to explain the remainder.
 */
export function monthsCovered(from: string, to: string): number {
  if (to < from) {
    return 0;
  }
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number);
  const [toYear, toMonth, toDay] = to.split('-').map(Number);

  let months = 0;
  let year = fromYear;
  let month = fromMonth;
  while (year < toYear || (year === toYear && month <= toMonth)) {
    const total = daysInMonth(year, month);
    const firstDay = year === fromYear && month === fromMonth ? fromDay : 1;
    const lastDay = year === toYear && month === toMonth ? toDay : total;
    months += (lastDay - firstDay + 1) / total;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

/** The overlap of two inclusive date windows, or null when they do not meet. */
export function overlap(
  a: { from: string; to: string },
  b: { from: string | null; to: string | null },
): { from: string; to: string } | null {
  const from = b.from && b.from > a.from ? b.from : a.from;
  const to = b.to && b.to < a.to ? b.to : a.to;
  return to < from ? null : { from, to };
}

/**
 * What a limit amounts to over a window.
 *
 * Every limit is first expressed per month — the convention the budgets module
 * already uses everywhere — and then multiplied by the months the window
 * covers. A budget that only governs part of the window contributes only that
 * part, which is why its own start and end are clipped first.
 */
export function plannedForWindow(
  limitAmount: number,
  periodType: BudgetPeriodType,
  window: { from: string; to: string },
): number {
  return normalizeLimitToMonth(limitAmount, periodType) * monthsCovered(window.from, window.to);
}

/** A category and every category under it, however deep. */
export function categoryFamily(
  categoryId: string,
  parentOf: ReadonlyMap<string, string | null>,
): Set<string> {
  const family = new Set([categoryId]);
  // A category belongs when any of its ancestors does. Walking up from each one
  // is cheap at the size of a category tree, and a cycle stops at a seen id.
  for (const id of parentOf.keys()) {
    const seen = new Set<string>();
    let cursor: string | null | undefined = id;
    while (cursor && !seen.has(cursor)) {
      if (cursor === categoryId) {
        family.add(id);
        break;
      }
      seen.add(cursor);
      cursor = parentOf.get(cursor);
    }
  }
  return family;
}
