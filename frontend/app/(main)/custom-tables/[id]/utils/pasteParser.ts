import { format } from 'date-fns';
import { PASTE_FIELD_ALIASES, type PasteFieldKey } from './pasteTypes';

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

export const normalizeToken = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[\s._-]+/g, '')
    .trim();

export const matchFieldByName = (raw: string): PasteFieldKey | null => {
  const normalized = normalizeToken(raw);
  if (!normalized) {
    return null;
  }
  for (const [field, aliases] of Object.entries(PASTE_FIELD_ALIASES)) {
    if (aliases.some(alias => normalized === normalizeToken(alias))) {
      return field as PasteFieldKey;
    }
    if (aliases.some(alias => normalized.includes(normalizeToken(alias)))) {
      return field as PasteFieldKey;
    }
  }
  return null;
};

// ---------------------------------------------------------------------------
// Clipboard row parsing
// ---------------------------------------------------------------------------

const charIsQuote = (char: string): boolean => char === '"';

type QuoteAdvanceArgs = { line: string; i: number; inQuotes: boolean; current: string };

const advanceQuotedChar = ({
  line,
  i,
  inQuotes,
  current,
}: QuoteAdvanceArgs): { current: string; i: number; inQuotes: boolean } => {
  if (inQuotes && line[i + 1] === '"') {
    return { current: `${current}"`, i: i + 1, inQuotes };
  }
  return { current, i, inQuotes: !inQuotes };
};

export const splitDelimitedRow = (line: string, delimiter: string): string[] => {
  if (!line) {
    return [''];
  }
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;
  while (i < line.length) {
    const char = line[i];
    if (charIsQuote(char)) {
      const next = advanceQuotedChar({ line, i, inQuotes, current });
      current = next.current;
      i = next.i;
      inQuotes = next.inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
    i += 1;
  }
  result.push(current);
  return result;
};

const detectDelimiter = (lines: string[]): string => {
  const hasTabs = lines.some(line => line.includes('\t'));
  if (hasTabs) {
    return '\t';
  }
  const commaCount = lines.reduce((acc, line) => acc + (line.match(/,/g)?.length ?? 0), 0);
  const semiCount = lines.reduce((acc, line) => acc + (line.match(/;/g)?.length ?? 0), 0);
  if (semiCount > commaCount && semiCount > 0) {
    return ';';
  }
  if (commaCount > 0) {
    return ',';
  }
  return '\t';
};

export const parseClipboardRows = (text: string): { rows: string[][]; delimiter: string } => {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  if (lines.length && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }
  const delimiter = detectDelimiter(lines);
  const rows = lines.map(line => splitDelimitedRow(line, delimiter));
  return { rows, delimiter };
};

// ---------------------------------------------------------------------------
// Date cell parsing
// ---------------------------------------------------------------------------

export type ParsedCell<T> = { value: T | null; error: boolean };

type DateParts = { year: number; month: number; day: number };

const parseDateFromIso = (raw: string): DateParts | null => {
  const isoMatch = raw.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (!isoMatch) {
    return null;
  }
  return { year: Number(isoMatch[1]), month: Number(isoMatch[2]), day: Number(isoMatch[3]) };
};

const parseDateFromDmy = (raw: string): DateParts | null => {
  const dmyMatch = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!dmyMatch) {
    return null;
  }
  return { year: Number(dmyMatch[3]), month: Number(dmyMatch[2]), day: Number(dmyMatch[1]) };
};

const validateParsedDate = (date: Date, parts: DateParts): boolean =>
  !Number.isNaN(date.getTime()) &&
  date.getFullYear() === parts.year &&
  date.getMonth() === parts.month - 1 &&
  date.getDate() === parts.day;

export const parseDateCell = (raw: string): ParsedCell<string> => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { value: null, error: false };
  }
  const parts = parseDateFromIso(trimmed) ?? parseDateFromDmy(trimmed);
  if (!parts) {
    // «1500», «12%», «$80» — числа, а не даты: new Date('1500') охотно даёт 1500 год.
    // Свободный разбор оставляем текстам вроде «15 Sep 2026» или «2026/9/15 10:00».
    const looksLikeDate =
      /[A-Za-zА-Яа-я]/.test(trimmed) || (trimmed.match(/[./-]/g)?.length ?? 0) >= 2;
    if (!looksLikeDate) {
      return { value: null, error: true };
    }
    const fallback = new Date(trimmed);
    if (Number.isNaN(fallback.getTime())) {
      return { value: null, error: true };
    }
    return { value: format(fallback, 'yyyy-MM-dd'), error: false };
  }
  const { year, month, day } = parts;
  const parsed = new Date(year, month - 1, day);
  if (!validateParsedDate(parsed, parts)) {
    return { value: null, error: true };
  }
  return { value: format(parsed, 'yyyy-MM-dd'), error: false };
};

// ---------------------------------------------------------------------------
// Number cell parsing
// ---------------------------------------------------------------------------

const normalizeSingleSeparator = (stripped: string, sepIndex: number): string => {
  const digitsAfter = stripped.length - sepIndex - 1;
  if (digitsAfter === 3) {
    return stripped.replace(/[.,]/g, '');
  }
  return stripped.replace(/[.,]/g, (_match, offset: number) => (offset === sepIndex ? '.' : ''));
};

const normalizeMultipleSeparators = (stripped: string): string => {
  const lastComma = stripped.lastIndexOf(',');
  const lastDot = stripped.lastIndexOf('.');
  const decimalPos = Math.max(lastComma, lastDot);
  return stripped.replace(/[.,]/g, (_match, offset: number) => (offset === decimalPos ? '.' : ''));
};

const normalizeStripped = (stripped: string): string => {
  const separators = stripped.match(/[.,]/g) || [];
  if (separators.length === 1) {
    return normalizeSingleSeparator(stripped, stripped.search(/[.,]/));
  }
  if (separators.length > 1) {
    return normalizeMultipleSeparators(stripped);
  }
  return stripped.replace(/[.,]/g, '');
};

export type ParsedNumberDetails = ParsedCell<number> & {
  /** Код валюты, если он стоял рядом с числом: «$1,234», «1 500 KZT», «200 руб.». */
  currency: string | null;
  /** «12%» — число 12 с пометкой; колонка сама решит, показывать ли его как процент. */
  percent: boolean;
  /** Сколько знаков после запятой было в исходнике. */
  decimals: number;
};

const NUMBER_FAILURE: ParsedNumberDetails = {
  value: null,
  error: true,
  currency: null,
  percent: false,
  decimals: 0,
};

const stripNumberNoise = (raw: string): string =>
  raw
    .replace(/[\s\u00A0\u202F]/g, '')
    .replace(/[\u2212\u2012\u2013]/g, '-')
    .replace(/[\u2019']/g, '');

const currencyFromAffix = (affix: string): string | null => {
  const cleaned = affix.replace(/[.,:]/g, '').trim();
  return cleaned ? resolveCurrencyCode(cleaned) : null;
};

/**
 * Разбирает число так, как его пишут в таблицах: с пробелами тысяч, знаком
 * валюты с любой стороны, процентом, скобками и хвостовым минусом для отрицательных.
 */
export const parseNumberCellDetailed = (raw: string): ParsedNumberDetails => {
  let text = stripNumberNoise(raw);
  if (!text) {
    return { value: null, error: false, currency: null, percent: false, decimals: 0 };
  }
  let negative = false;
  if (text.startsWith('(') && text.endsWith(')')) {
    negative = true;
    text = text.slice(1, -1);
  }
  const percent = text.includes('%');
  text = text.replace(/%/g, '');
  if (text.endsWith('-')) {
    negative = true;
    text = text.slice(0, -1);
  }
  // «-$100»: знак перед символом валюты, а не перед цифрами.
  if (text.startsWith('-') || text.startsWith('+')) {
    negative = negative || text.startsWith('-');
    text = text.slice(1);
  }
  const parts = text.match(/^([^\d]*?)([-+]?[\d.,]+)([^\d]*)$/u);
  if (!parts) {
    return NUMBER_FAILURE;
  }
  const [, prefix, body, suffix] = parts;
  const affix = prefix || suffix;
  let currency: string | null = null;
  if (affix) {
    currency = currencyFromAffix(affix);
    if (!currency) {
      return NUMBER_FAILURE;
    }
  }
  const sign = body.startsWith('-') ? -1 : 1;
  const digits = body.replace(/^[-+]/, '');
  const normalized = normalizeStripped(digits);
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return NUMBER_FAILURE;
  }
  const magnitude = Number(normalized);
  if (!Number.isFinite(magnitude)) {
    return NUMBER_FAILURE;
  }
  const decimals = normalized.includes('.') ? normalized.length - normalized.indexOf('.') - 1 : 0;
  return {
    value: (negative ? -1 : 1) * sign * magnitude,
    error: false,
    currency,
    percent,
    decimals,
  };
};

export const parseNumberCell = (raw: string): ParsedCell<number> => {
  const { value, error } = parseNumberCellDetailed(raw);
  return { value, error };
};

// ---------------------------------------------------------------------------
// Currency cell parsing
// ---------------------------------------------------------------------------

const CURRENCY_ALIASES: Record<string, string[]> = {
  KZT: ['kzt', 'тенге', 'теңге', 'тг', 'tg'],
  RUB: ['rub', 'руб', 'рубль', 'ruble', 'rur'],
  USD: ['usd', 'доллар', 'доллары', 'us$', 'бакс'],
  EUR: ['eur', 'евро'],
  GBP: ['gbp', 'фунт'],
  CNY: ['cny', 'юань', 'yuan', 'rmb'],
  JPY: ['jpy', 'иена', 'yen'],
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  $: 'USD',
  '€': 'EUR',
  '₽': 'RUB',
  '₸': 'KZT',
  '£': 'GBP',
  '¥': 'JPY',
};

const normalizeCurrencyToken = (value: string): string =>
  normalizeToken(value).replace(/[^\p{L}\p{N}]/gu, '');

export const resolveCurrencyCode = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (CURRENCY_SYMBOLS[trimmed]) {
    return CURRENCY_SYMBOLS[trimmed];
  }
  const upper = trimmed.toUpperCase();
  if (/^[A-Z]{3}$/.test(upper)) {
    return upper;
  }
  const normalized = normalizeCurrencyToken(trimmed);
  for (const [code, aliases] of Object.entries(CURRENCY_ALIASES)) {
    if (aliases.some(alias => normalizeCurrencyToken(alias) === normalized)) {
      return code;
    }
  }
  return null;
};

const matchCurrencyInOptions = (
  trimmed: string,
  options: string[],
  resolved: string | null,
): string | null => {
  const normalizedOptions = options.map(opt => normalizeToken(opt));
  const matchIndex = normalizedOptions.indexOf(normalizeToken(trimmed));
  if (matchIndex !== -1) {
    return options[matchIndex];
  }
  if (resolved) {
    const resolvedIndex = normalizedOptions.indexOf(normalizeToken(resolved));
    if (resolvedIndex !== -1) {
      return options[resolvedIndex];
    }
  }
  return null;
};

export const parseCurrencyCell = (raw: string, options?: string[]): ParsedCell<string> => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { value: null, error: false };
  }
  const resolved = resolveCurrencyCode(trimmed);
  if (options?.length) {
    const match = matchCurrencyInOptions(trimmed, options, resolved);
    if (match) {
      return { value: match, error: false };
    }
    return { value: null, error: true };
  }
  if (resolved) {
    return { value: resolved, error: false };
  }
  return { value: null, error: true };
};

// ---------------------------------------------------------------------------
// Paid cell parsing
// ---------------------------------------------------------------------------

const PAID_POSITIVE = [
  'true',
  '1',
  'yes',
  'y',
  't',
  'да',
  'оплачено',
  'paid',
  '✓',
  '✔',
  '☑',
  'x',
  '+',
];
const PAID_NEGATIVE = [
  'false',
  '0',
  'no',
  'n',
  'f',
  'нет',
  'неоплачено',
  'не оплачено',
  'не оплачен',
  'unpaid',
  '✗',
  '✘',
  '☐',
  '-',
  '—',
];

export const parsePaidCell = (raw: string): ParsedCell<boolean> => {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) {
    return { value: null, error: false };
  }
  if (PAID_POSITIVE.includes(trimmed)) {
    return { value: true, error: false };
  }
  if (PAID_NEGATIVE.includes(trimmed)) {
    return { value: false, error: false };
  }
  return { value: null, error: true };
};
