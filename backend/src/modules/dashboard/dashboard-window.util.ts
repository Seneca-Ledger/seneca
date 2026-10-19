export interface DashboardWindow {
  since: Date;
  endDate: Date;
}

/** A rolling window of `days` days ending at `targetDate` (inclusive, end of day). */
export function getWindowBounds(days: number, targetDate: Date): DashboardWindow {
  const endDate = new Date(targetDate);
  endDate.setHours(23, 59, 59, 999);

  const since = new Date(endDate);
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  return { since, endDate };
}

/** The calendar month containing `anchorDate`, from day 1 00:00:00 to the last day 23:59:59.999. */
export function getMonthWindowBounds(anchorDate: Date): DashboardWindow {
  const since = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1, 0, 0, 0, 0);
  const endDate = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0, 23, 59, 59, 999);
  return { since, endDate };
}

const MONTH_PARAM = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** `YYYY-MM` → that calendar month's window; anything else (including `undefined`) → `null`. */
export function parseMonthWindow(month: string | undefined): DashboardWindow | null {
  const match = month ? MONTH_PARAM.exec(month) : null;
  return match ? getMonthWindowBounds(new Date(Number(match[1]), Number(match[2]) - 1, 1)) : null;
}

/** January 1 00:00 to December 31 23:59:59.999 of `year`, local time. */
export function getYearWindowBounds(year: number): DashboardWindow {
  return { since: new Date(year, 0, 1), endDate: new Date(year, 11, 31, 23, 59, 59, 999) };
}

export const CASH_FLOW_RANGES = ['12m', 'this_year', '5y', 'all'] as const;

export type CashFlowRange = (typeof CASH_FLOW_RANGES)[number];

/** Months before the current one that a fixed-length range reaches back. */
const CASH_FLOW_MONTHS_BACK: Record<'12m' | '5y', number> = { '12m': 11, '5y': 59 };

/**
 * Whole calendar months ending with the month containing `anchor` (the dashboard's picked month,
 * or today). `this_year` is the anchor's year up to the anchor month. `all` starts at the month of
 * `earliest` and is `null` when there are no transactions up to the anchor month.
 */
export function getCashFlowRangeBounds(
  range: CashFlowRange,
  anchor: Date,
  earliest: Date | null,
): DashboardWindow | null {
  const endDate = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59, 999);
  let since: Date;
  if (range === 'all') {
    if (!earliest || earliest > endDate) {
      return null;
    }
    since = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
  } else if (range === 'this_year') {
    since = new Date(anchor.getFullYear(), 0, 1);
  } else {
    since = new Date(anchor.getFullYear(), anchor.getMonth() - CASH_FLOW_MONTHS_BACK[range], 1);
  }
  return { since, endDate };
}

/** Number of days in the calendar month containing `anchorDate`. */
export function daysInMonth(anchorDate: Date): number {
  return new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0).getDate();
}
