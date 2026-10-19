import { useMemo } from 'react';
import { resolveLocale } from '@/app/(main)/dashboard/helpers/dashboard-helpers';
import { useLocale } from '@/app/i18n';

/** "August 2026" in the active UI locale. */
export function useMonthLabel(displayMonth: Date): string {
  const { locale } = useLocale();
  return useMemo(
    () =>
      new Intl.DateTimeFormat(resolveLocale(locale), { month: 'long', year: 'numeric' }).format(
        displayMonth,
      ),
    [locale, displayMonth],
  );
}
