'use client';

import { useCallback } from 'react';
import { useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';

/**
 * Money as the rest of the app writes it, in the reader's locale: "$122.93",
 * "$1,240" — cents only under 100, a typographic minus. The analytics helper
 * this replaces formatted everything Russian-style ("122,93 $") by default.
 */
export function useAnalyticsMoney(): (value: number, currency: string) => string {
  const { locale } = useLocale();
  return useCallback(
    (value: number, currency: string) =>
      formatMoney(value, currency, locale, {
        fractionDigits: Math.abs(value) >= 100 || Number.isInteger(value) ? 0 : 2,
      }).replace('-', '−'),
    [locale],
  );
}
