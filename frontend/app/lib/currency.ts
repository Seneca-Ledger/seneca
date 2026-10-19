/**
 * The currency to show when a record carries none.
 *
 * The workspace's own currency is the answer almost everywhere, and the API now
 * always sends it, so this is a last resort for the few places that render
 * before a workspace is loaded. `NEXT_PUBLIC_DEFAULT_CURRENCY` is read at build
 * time (like every `NEXT_PUBLIC_*` value), so a self-hoster sets it once in the
 * build and never sees someone else's currency in the gaps.
 */
const CURRENCY_CODE = /^[A-Z]{3}$/;

function normalize(value: string | null | undefined): string | null {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase();
  return CURRENCY_CODE.test(normalized) ? normalized : null;
}

export const FALLBACK_CURRENCY = normalize(process.env.NEXT_PUBLIC_DEFAULT_CURRENCY) ?? 'USD';

/** A currency code, or `fallback` when the value is missing or not a code. */
export function currencyOr(
  value: string | null | undefined,
  fallback: string = FALLBACK_CURRENCY,
): string {
  return normalize(value) ?? fallback;
}

/**
 * Seeds the "recently used" row of a currency picker. The installation's own
 * currency comes first; the rest are the codes most pickers need next.
 */
export const DEFAULT_RECENT_CURRENCIES: readonly string[] = [
  ...new Set([FALLBACK_CURRENCY, 'USD', 'EUR', 'GBP']),
];
