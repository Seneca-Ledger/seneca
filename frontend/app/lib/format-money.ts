/**
 * Shared currency formatting utilities used across transaction and analytics views.
 */

import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { resolveLocaleTag } from '@/app/lib/user-format';

/**
 * Maps app locale keys to BCP 47 locale strings for Intl.NumberFormat.
 * Delegates to the shared resolver so money and dates cannot drift apart.
 */
export const resolveLocale = (locale?: string): string => resolveLocaleTag(locale);

/**
 * Validates and normalises a currency code to a 3-letter ISO 4217 uppercase string.
 * Returns `fallback` if the input is empty or invalid.
 */
export const resolveCurrencyCode = (
  currency: string | null | undefined,
  fallback = FALLBACK_CURRENCY,
): string => {
  const normalized = String(currency ?? '')
    .trim()
    .toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : fallback;
};

/**
 * Intl's compact notation tops out at "T" (10^12) and just appends more digits
 * past that (e.g. "1,000,000T"), so past this magnitude it stops being compact.
 */
export const COMPACT_NOTATION_CEILING = 1e15;

/**
 * Formats a numeric `value` as a localised currency string.
 *
 * @param value     - Numeric amount to format.
 * @param currency  - ISO 4217 currency code (e.g. 'EUR', 'USD').
 * @param locale    - App locale key ('en' | 'ru' | 'kk').  Defaults to 'en'.
 */
export const formatMoney = (
  value: number,
  currency: string,
  locale = 'en',
  options: { fractionDigits?: number; notation?: 'standard' | 'compact' } = {},
): string => {
  if (Number.isNaN(value)) return '—';
  const requested = options.notation ?? 'standard';
  const notation =
    requested === 'compact' && Math.abs(value) >= COMPACT_NOTATION_CEILING
      ? 'scientific'
      : requested;
  const fractionDigits = options.fractionDigits ?? (notation === 'standard' ? 2 : 1);
  return new Intl.NumberFormat(resolveLocale(locale), {
    style: 'currency',
    currency: resolveCurrencyCode(currency),
    notation,
    minimumFractionDigits: notation === 'standard' ? fractionDigits : 0,
    maximumFractionDigits: fractionDigits,
  }).format(value);
};
