/**
 * Where a currency comes from when the amount itself does not carry one.
 *
 * Every amount in this system belongs to a workspace, and the workspace's own
 * currency is the answer in all but one case: a workspace created before the
 * currency became required, or one whose stored code is not a currency at all.
 * `DEFAULT_CURRENCY` covers that one case for the whole installation.
 *
 * There is deliberately no other hardcoded currency in the codebase: a
 * self-hoster in any country gets their own currency, not whichever one the
 * first developer happened to type.
 */

const FALLBACK_CURRENCY = 'USD';

/** ISO 4217 alphabetic codes are three letters; crypto tickers are not currencies here. */
const CURRENCY_CODE = /^[A-Z]{3}$/;

/** The installation-wide default, from `DEFAULT_CURRENCY`, or USD when unset. */
export function appDefaultCurrency(): string {
  return normalize(process.env.DEFAULT_CURRENCY) ?? FALLBACK_CURRENCY;
}

/**
 * Trims and upper-cases a currency code, falling back when it is missing or is
 * not a three-letter code. Pass a `fallback` to keep a nearer source of truth
 * (a wallet's or a statement's currency, say) ahead of the installation default.
 */
export function currencyCodeOrDefault(
  value: string | null | undefined,
  fallback: string = appDefaultCurrency(),
): string {
  return normalize(value) ?? fallback;
}

function normalize(value: string | null | undefined): string | null {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase();
  return CURRENCY_CODE.test(normalized) ? normalized : null;
}
