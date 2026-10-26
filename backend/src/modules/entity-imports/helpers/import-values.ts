import {
  normalizeDate,
  normalizeNumberAdvanced,
} from '../../../common/utils/number-normalizer.util';

const CURRENCY_SYMBOLS: Record<string, string> = {
  $: 'USD',
  '€': 'EUR',
  '₽': 'RUB',
  '₸': 'KZT',
  '£': 'GBP',
  '¥': 'JPY',
};

export const isBlank = (value: string | undefined | null): boolean =>
  value === undefined || value === null || String(value).trim() === '';

/** «1 500,50 ₸», «$1,234», «(100)», «12%» → число; символ валюты отдельно. */
export function parseImportNumber(raw: string): { value: number | null; currency: string | null } {
  const text = String(raw ?? '').trim();
  if (!text) {
    return { value: null, currency: null };
  }
  let currency: string | null = null;
  let cleaned = text;
  for (const [symbol, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (cleaned.includes(symbol)) {
      currency = code;
      cleaned = cleaned.split(symbol).join('');
    }
  }
  const code = /(?:^|\s)([A-Za-z]{3})(?:\s|$)/.exec(cleaned);
  if (code && !/^\d/.test(code[1])) {
    currency = currency ?? code[1].toUpperCase();
    cleaned = cleaned.replace(code[0], ' ');
  }
  cleaned = cleaned.replace(/%/g, '').trim();
  const negative = /^\(.*\)$/.test(cleaned);
  const { value } = normalizeNumberAdvanced(negative ? cleaned.slice(1, -1) : cleaned);
  return { value: value === null ? null : negative ? -Math.abs(value) : value, currency };
}

/** Order of day and month in numeric dates such as `03/04/2026`. */
export type DateOrder = 'dmy' | 'mdy';

const NUMERIC_DATE = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})(?:[ T].*)?$/;

/**
 * The day/month order of a date column. One value that reads only one way
 * (`13/01/2026` or `01/13/2026`) settles it; a column where every value reads
 * both ways, or where both kinds occur, gives null.
 */
export function detectDateOrder(values: string[]): DateOrder | null {
  let dayFirst = false;
  let monthFirst = false;
  for (const value of values) {
    const match = NUMERIC_DATE.exec(String(value ?? '').trim());
    if (match) {
      dayFirst ||= Number(match[1]) > 12;
      monthFirst ||= Number(match[2]) > 12;
    }
  }
  if (dayFirst === monthFirst) {
    return null;
  }
  return dayFirst ? 'dmy' : 'mdy';
}

/** `03/04/26` in the given order as an ISO date; null for an impossible day such as 31/02. */
function numericDateIso(match: RegExpExecArray, order: DateOrder): string | null {
  const [first, second] = [Number(match[1]), Number(match[2])];
  const [day, month] = order === 'mdy' ? [second, first] : [first, second];
  const year =
    match[3].length === 2
      ? (Number(match[3]) < 70 ? 2000 : 1900) + Number(match[3])
      : Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date.toISOString().slice(0, 10)
    : null;
}

/**
 * ISO date from text or an Excel serial; null when it is not a date. `order`
 * reads numeric dates of a column whose day/month order is known.
 */
export function parseImportDate(raw: string, order?: DateOrder | null): string | null {
  const text = String(raw ?? '').trim();
  if (!text) {
    return null;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  const numeric = order ? NUMERIC_DATE.exec(text) : null;
  if (numeric && order) {
    return numericDateIso(numeric, order);
  }
  const serial = Number(text);
  if (Number.isFinite(serial) && serial > 15_000 && serial < 80_000) {
    return new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000).toISOString().slice(0, 10);
  }
  const date = normalizeDate(text);
  return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

const TRUE_WORDS = ['true', 'yes', 'y', '1', 'да', '+', '✓', '✔', 'x'];
const FALSE_WORDS = ['false', 'no', 'n', '0', 'нет', '-', '—', '✗', '✘', ''];

export function parseImportBoolean(raw: string): boolean | null {
  const text = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (TRUE_WORDS.includes(text)) {
    return true;
  }
  if (FALSE_WORDS.includes(text)) {
    return false;
  }
  return null;
}

export const normalizeCurrencyCode = (raw: string | null | undefined): string | null => {
  const text = String(raw ?? '')
    .trim()
    .toUpperCase();
  return /^[A-Z]{3}$/.test(text) ? text : null;
};

/** Case-insensitive, punctuation-insensitive key for names. */
export const nameKey = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
