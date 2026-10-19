/**
 * Dashboard state that lives in the URL (`?month=YYYY-MM&tab=trends&cf=5y`) so a
 * reload or a shared link restores the same view. Pure helpers, no React.
 */

import type { DashboardCashFlowRange } from '@/app/hooks/useDashboard.types';

export const DASHBOARD_TABS = ['overview', 'trends', 'finance-ops', 'data-health'] as const;
export type DashboardTabId = (typeof DASHBOARD_TABS)[number];
export const DEFAULT_DASHBOARD_TAB: DashboardTabId = 'overview';

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

export function parseTabParam(value: string | null | undefined): DashboardTabId {
  return (DASHBOARD_TABS as readonly string[]).includes(value ?? '')
    ? (value as DashboardTabId)
    : DEFAULT_DASHBOARD_TAB;
}

/** Trends cash-flow period (`?cf=`), in the order the switcher shows them. */
export const CASH_FLOW_RANGES = [
  'all',
  '5y',
  '12m',
  'this_year',
] as const satisfies readonly DashboardCashFlowRange[];
export const DEFAULT_CASH_FLOW_RANGE: DashboardCashFlowRange = '12m';

export function parseCashFlowRangeParam(value: string | null | undefined): DashboardCashFlowRange {
  return (CASH_FLOW_RANGES as readonly string[]).includes(value ?? '')
    ? (value as DashboardCashFlowRange)
    : DEFAULT_CASH_FLOW_RANGE;
}

/** Applies a patch to the current query; `null` removes a key. Returns the query string without `?`. */
export function withDashboardParams(
  current: URLSearchParams | string,
  patch: { month?: string | null; tab?: string | null; cf?: string | null },
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
