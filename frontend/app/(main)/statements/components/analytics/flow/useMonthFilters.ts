'use client';

import { useMemo } from 'react';
import { formatMonthParam } from '@/app/(main)/dashboard/helpers/dashboard-url-state';
import { useAnalyticsPeriod } from '@/app/(main)/statements/components/analytics/flow/analytics-period';
import { monthDeepLinkFilters } from '@/app/(main)/statements/components/filters/month-deep-link';
import {
  DEFAULT_STATEMENT_FILTERS,
  type StatementFilters,
} from '@/app/(main)/statements/components/filters/statement-filters';

/**
 * The statement filters one analytics view applies: its own month and nothing
 * else. Filters saved by older versions of these pages (they had filter chips)
 * must not keep narrowing the numbers invisibly.
 */
export function useMonthFilters(month: Date): StatementFilters {
  const monthKey = formatMonthParam(month);
  const period = useAnalyticsPeriod();
  const from = period?.from;
  const to = period?.to;
  return useMemo(() => {
    // A period set by the page wins over the section's own month.
    if (from && to) {
      return { ...DEFAULT_STATEMENT_FILTERS, date: { mode: 'on', date: from, dateTo: to } };
    }
    return monthDeepLinkFilters(monthKey) ?? DEFAULT_STATEMENT_FILTERS;
  }, [monthKey, from, to]);
}
