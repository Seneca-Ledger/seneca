'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { parseMonthParam } from '@/app/(main)/dashboard/helpers/dashboard-url-state';

export interface SectionMonth {
  month: Date;
  changeMonth: (year: number, monthIndex: number) => void;
}

/**
 * One section's month. Each leaderboard on the Cash flow tab steps through
 * months on its own, so the month cannot live in `?month=` the way it did when
 * each was its own page — the URL would have to hold three of them. It is read
 * from there once, so an advice link that names a month still opens on it.
 */
export function useSectionMonth(): SectionMonth {
  const deepLinkMonth = useSearchParams()?.get('month') ?? null;
  const [month, setMonth] = useState(() => parseMonthParam(deepLinkMonth) ?? new Date());
  const changeMonth = useCallback((year: number, monthIndex: number): void => {
    setMonth(new Date(year, monthIndex, 1));
  }, []);
  return { month, changeMonth };
}
