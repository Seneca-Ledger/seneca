'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { formatMonthParam, parseMonthParam } from '../../../dashboard/helpers/dashboard-url-state';

export interface MonthParamState {
  month: Date;
  changeMonth: (year: number, monthIndex: number) => void;
}

/**
 * The selected month lives in the URL (`?month=YYYY-MM`) so a reload or a shared
 * link restores the same view, the way the dashboard does it.
 */
export function useMonthParam(): MonthParamState {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams?.toString() ?? '';

  const month = useMemo(
    () => parseMonthParam(searchParams?.get('month')) ?? new Date(),
    [searchParams],
  );

  const changeMonth = useCallback(
    (year: number, monthIndex: number): void => {
      const next = new URLSearchParams(query);
      next.set('month', formatMonthParam(new Date(year, monthIndex, 1)));
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [router, pathname, query],
  );

  return { month, changeMonth };
}
