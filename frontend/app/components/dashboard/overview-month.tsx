'use client';

import { createContext, useContext } from 'react';
import { useLocale } from '@/app/i18n';
import { currentMonthKey } from './month-end';

/**
 * The `YYYY-MM` month the Overview shows. Outside the Overview a card has no
 * month strip above it, which reads as the month we are in.
 */
const OverviewMonthContext = createContext<string | null>(null);

export const OverviewMonthProvider = OverviewMonthContext.Provider;

/**
 * "Today", in the reader's language, for a card that always tells the present
 * (what is owed, what charges next) while the Overview shows another month, so
 * its figures are not read as that month's. Null when the month in view is this one.
 */
export function useTodayNote(): string | null {
  const month = useContext(OverviewMonthContext);
  const { locale } = useLocale();
  if (!month || month === currentMonthKey()) {
    return null;
  }
  const today = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(0, 'day');
  return today.charAt(0).toLocaleUpperCase(locale) + today.slice(1);
}
