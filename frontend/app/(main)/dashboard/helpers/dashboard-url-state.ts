/**
 * Dashboard state that lives in the URL (`?month=YYYY-MM`) so a
 * reload or a shared link restores the same view. Pure helpers, no React.
 */

const MONTH_PARAM = /^(\d{4})-(\d{2})$/;

/** Parses `YYYY-MM` into the first day of that month (local time); anything else is `null`. */
export function parseMonthParam(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const match = MONTH_PARAM.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    return null;
  }
  return new Date(year, month - 1, 1);
}

export function formatMonthParam(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Applies a patch to the current query; `null` removes a key. Returns the query string without `?`. */
export function withDashboardParams(
  current: URLSearchParams | string,
  patch: { month?: string | null },
): string {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      continue;
    }
    if (value === null) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  }
  return next.toString();
}

/** True when the given month starts after the current month. */
export function isFutureMonth(year: number, month: number, now: Date = new Date()): boolean {
  if (year !== now.getFullYear()) {
    return year > now.getFullYear();
  }
  return month > now.getMonth();
}
