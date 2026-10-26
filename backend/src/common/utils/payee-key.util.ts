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

/**
 * Words that name the document rather than who issued it. A key made only of
 * these ("Invoice number 2955 6044", "Tax invoice", "Receipt") would file every
 * invoice from every supplier under one payee, so such a descriptor has no key.
 * Compared after diacritics are stripped, so "счёт" arrives as "счет".
 */
const DOCUMENT_WORDS = new Set([
  'invoice',
  'inv',
  'receipt',
  'bill',
  'order',
  'payment',
  'document',
  'tax',
  'number',
  'no',
  'nr',
  'ref',
  'reference',
  'unknown',
  'merchant',
  'rechnung',
  'quittung',
  'beleg',
  'factura',
  'facture',
  'fattura',
  'recibo',
  'faktura',
  'чек',
  'счет',
  'фактура',
  'квитанция',
  'номер',
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
  /** Only read when the counterparty names nobody (see `payeeKeyOf`). */
  paymentPurpose?: string | null;
};

/** The key of one string, or `null` when it holds no name to key on. */
const keyOf = (value: string | null | undefined): string | null => {
  const source = (value ?? '').trim();
  if (!source || isPlaceholder(source)) {
    return null;
  }

  const tokens = stripDiacritics(dropAcquirerPrefix(source))
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(token => token && !isReference(token));

  return tokens.some(token => !DOCUMENT_WORDS.has(token)) ? tokens.join(' ') : null;
};

/**
 * The payee key, or `null` when the descriptor holds no name to key on. The
 * payment purpose is only read when the counterparty names nobody: missing, a
 * parser placeholder, or only document words like "Invoice number 2955".
 */
export function payeeKeyOf({ counterpartyName, paymentPurpose }: PayeeKeyInput): string | null {
  return keyOf(counterpartyName) ?? keyOf(paymentPurpose);
}

/**
 * The descriptor a new payee is named after: whichever of the two strings the
 * key came from, trimmed. The user renames it from there.
 */
export function payeeNameOf({ counterpartyName, paymentPurpose }: PayeeKeyInput): string | null {
  const source = keyOf(counterpartyName)
    ? counterpartyName
    : keyOf(paymentPurpose)
      ? paymentPurpose
      : null;
  return source ? source.trim().slice(0, 200) : null;
}
