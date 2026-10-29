'use client';

import { createContext, useContext } from 'react';
import { resolveLocale } from '@/app/(main)/dashboard/helpers/dashboard-helpers';
import { useLocale } from '@/app/i18n';
import { currentMonthKey } from './month-end';

/**
 * The `YYYY-MM` month the Overview shows. Outside the Overview a card has no
 * month strip above it, which reads as the month we are in.
 */
const OverviewMonthContext = createContext<string | null>(null);

export const OverviewMonthProvider = OverviewMonthContext.Provider;

/**
 * The month the Overview shows, `YYYY-MM`, and its name ("August 2026"), for a
 * card that follows it. Null outside the Overview.
 */
export function useOverviewMonth(): { month: string; label: string } | null {
  const month = useContext(OverviewMonthContext);
  const { locale } = useLocale();
  if (!month) {
    return null;
  }
  const [year, monthNumber] = month.split('-').map(Number);
  const label = new Intl.DateTimeFormat(resolveLocale(locale), {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, monthNumber - 1, 1));
  return { month, label };
}

/** The Overview shows a month other than the one we are in. */
export function useShowsOtherMonth(): boolean {
  const month = useContext(OverviewMonthContext);
  return month !== null && month !== currentMonthKey();
}

/**
 * "Today", in the reader's language, for a card that always tells the present
 * (what is owed, what charges next) while the Overview shows another month, so
 * its figures are not read as that month's. Null when the month in view is this one.
 */
export function useTodayNote(): string | null {
  const otherMonth = useShowsOtherMonth();
  const { locale } = useLocale();
  if (!otherMonth) {
    return null;
  }
  const today = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(0, 'day');
  return today.charAt(0).toLocaleUpperCase(locale) + today.slice(1);
}
