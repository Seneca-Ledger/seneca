import { normalizeNumber } from '../../../common/utils/number-normalizer.util';

const CURRENCY_SYMBOLS = '$€£¥₸₽₪₹฿';

/** "S$", "HK$", "€", or an ISO code such as "SGD" printed next to the figure. */
const CURRENCY_MARK = new RegExp(`(?:[A-Z]{0,3}[${CURRENCY_SYMBOLS}]|\\b[A-Z]{3}\\b)`, 'g');

/**
 * A currency sign written with letters and glued to the figure, the sign of
 * the amount before it: "R7 822.73", "-R200.00" (rand), "RM12.00" (ringgit),
 * "Rp5.000,00" (rupiah).
 */
export const LETTER_SIGN = /(?<![A-Za-z])(?:RM|Rp|R)(?=\d)/;
const LETTER_SIGNS = new RegExp(LETTER_SIGN.source, 'g');

/**
 * A money figure as statements print it: optional sign or parentheses, digits
 * grouped by space, dot or comma, and exactly two decimals ("1,902.69",
 * "-1.450,77", "1 200,45", "(12.00)", "100.00-"). Requiring the decimals keeps
 * reference numbers such as "8373579" out.
 */
const AMOUNT_SHAPE = /^[-+(]?(?:\d{1,3}(?:[ .,  ]\d{3})+|\d+)[.,]\d{2}\)?-?$/;

/** Parses a printed amount, currency marks included; null when it is not one. */
export function parseStatementAmount(text: string): number | null {
  const bare = text
    .replace(LETTER_SIGNS, '')
    .replace(CURRENCY_MARK, '')
    .replace(/\s+/g, ' ')
    .replace(/−/g, '-')
    .trim();
  if (!AMOUNT_SHAPE.test(bare)) {
    return null;
  }
  return normalizeNumber(bare);
}

/**
 * A currency mark glued to the figure, the sign of the amount before it or
 * not: "$4,082.88", "-$503.00", "S$12.00".
 */
const GLUED_SYMBOL = new RegExp(`^([-+(−]?)[A-Z]{0,3}[${CURRENCY_SYMBOLS}](?=\\d)`);

/** A word that can be part of a printed amount: digits, a sign, or a currency mark. */
export function isAmountPart(word: string): boolean {
  const figure = word.replace(LETTER_SIGNS, '').replace(GLUED_SYMBOL, '$1');
  return (
    /^[-+(−]?[\d.,]*\d[\d.,]*\)?-?$/.test(figure) ||
    new RegExp(`^(?:[A-Z]{0,3}[${CURRENCY_SYMBOLS}]|[A-Z]{3}|[-+=])$`).test(word)
  );
}

/**
 * Every amount in a line of free text, in order. Dates have to be removed
 * first: "1 janvier 2025 10 750,00 $" would otherwise read "2025 10".
 */
export function findStatementAmounts(text: string): number[] {
  const pattern = new RegExp(
    `[-+]?(?:${LETTER_SIGN.source})?(?:\\d{1,3}(?:[ .,  ]\\d{3})+|\\d+)[.,]\\d{2}(?!\\d)`,
    'g',
  );
  return Array.from(text.matchAll(pattern), match => parseStatementAmount(match[0])).filter(
    (value): value is number => value !== null,
  );
}
