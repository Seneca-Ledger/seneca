/**
 * Turns the string a bank put on a transaction into a stable key for one payee.
 *
 * The same shop charges a different terminal number, order id or date every
 * time, so the raw descriptor is useless as an identity: `REWE SAGT DANKE 6334`
 * and `REWE SAGT DANKE 1182` are the same shop and have to produce one key
 * before anything can be learned about that shop.
 *
 * The key is internal. It is never shown in place of the raw descriptor, and a
 * rule the user wrote is never matched against it — a rule matches the raw
 * string, so that changing how this file normalises can never break one.
 */

/** Payment processors that prefix the real merchant, as `<NAME> *MERCHANT`. */
const ACQUIRER_PREFIXES = new Set([
  'sq',
  'sqc',
  'tst',
  'paypal',
  'pp',
  'pay',
  'sumup',
  'iz',
  'zettle',
  'izettle',
  'wpy',
  'wp',
  'sp',
  'ebay',
  'stripe',
  'cheddar',
  'toast',
  'clover',
]);

/** What a parser writes when the file named no counterparty at all. */
const PLACEHOLDERS = new Set([
  'unknown',
  'n/a',
  'не указано',
  'неизвестно',
  'неизвестный контрагент',
  'нет данных',
]);

const stripDiacritics = (value: string): string =>
  value.normalize('NFKD').replace(/\p{Diacritic}/gu, '');

const isPlaceholder = (value: string): boolean => PLACEHOLDERS.has(value.trim().toLowerCase());

/**
 * A reference, not a word: either all digits (terminal, order, date part) or a
 * code that mixes letters with two or more digits (`2R45T9SK3`).
 */
const isReference = (token: string): boolean => {
  const digits = token.replace(/\D/g, '').length;
  return digits === token.length || digits >= 2;
};

const dropAcquirerPrefix = (value: string): string => {
  const match = /^([\p{L}\p{N}]+)\s*\*\s*/u.exec(value);
  if (!match) {
    return value;
  }
  return ACQUIRER_PREFIXES.has(match[1].toLowerCase()) ? value.slice(match[0].length) : value;
};

export type PayeeKeyInput = {
  counterpartyName?: string | null;
  /** Only read when the counterparty is missing or a parser placeholder. */
  paymentPurpose?: string | null;
};

/** The payee key, or `null` when the descriptor holds no name to key on. */
export function payeeKeyOf({ counterpartyName, paymentPurpose }: PayeeKeyInput): string | null {
  const named = (counterpartyName ?? '').trim();
  const source = named && !isPlaceholder(named) ? named : (paymentPurpose ?? '').trim();
  if (!source || isPlaceholder(source)) {
    return null;
  }

  const tokens = stripDiacritics(dropAcquirerPrefix(source))
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(token => token && !isReference(token));

  return tokens.length ? tokens.join(' ') : null;
}
