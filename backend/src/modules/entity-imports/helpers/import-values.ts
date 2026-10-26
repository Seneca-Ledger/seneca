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

/** ISO date from text or an Excel serial; null when it is not a date. */
export function parseImportDate(raw: string): string | null {
  const text = String(raw ?? '').trim();
  if (!text) {
    return null;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
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
