/**
 * Dates the way statements print them: "02/06/2025", "09/13" (no year),
 * "1 mei", "02 janv. 25", "Sep 3, 2025", "31 janvier 2025", "2025-05-31".
 *
 * Whether "09/01" is the 9th of January or September 1st is a property of the
 * document, not of one date, so callers settle the order once per statement
 * with `detectNumericDateOrder` and pass it in.
 */

export type NumericDateOrder = 'dmy' | 'mdy';

export interface DateParts {
  day: number;
  month: number;
  year?: number;
}

/** Month names and abbreviations in English, French, Dutch, German and Spanish. */
const MONTH_NAMES = [
  ['jan', 'january', 'janv', 'janvier', 'januari', 'januar', 'ene', 'enero'],
  ['feb', 'february', 'fev', 'fevr', 'fevrier', 'februari', 'februar', 'febrero'],
  ['mar', 'march', 'mars', 'mrt', 'maart', 'marz', 'marzo'],
  ['apr', 'april', 'avr', 'avril', 'abr', 'abril'],
  ['may', 'mai', 'mei', 'mayo'],
  ['jun', 'june', 'juin', 'juni', 'junio'],
  ['jul', 'july', 'juil', 'juillet', 'juli', 'julio'],
  ['aug', 'august', 'aout', 'augustus', 'ago', 'agosto'],
  ['sep', 'sept', 'september', 'septembre', 'set', 'septiembre', 'setiembre'],
  ['oct', 'october', 'octobre', 'okt', 'oktober', 'octubre'],
  ['nov', 'november', 'novembre', 'noviembre'],
  ['dec', 'december', 'decembre', 'dez', 'dezember', 'dic', 'diciembre'],
];
const MONTHS: Record<string, number> = Object.fromEntries(
  MONTH_NAMES.flatMap((names, index) => names.map(name => [name, index + 1])),
);

/**
 * Lower case without accents, one character in for one character out, so a
 * match index in the folded text is also an index in the original.
 */
export function foldText(text: string): string {
  return Array.from(text, char => {
    const folded = char.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    return folded.length === 1 ? folded : char;
  }).join('');
}

function monthFromName(name: string): number | null {
  return MONTHS[foldText(name).replace(/\.$/, '')] ?? null;
}

function fullYear(year: string | undefined): number | undefined {
  if (!year) {
    return undefined;
  }
  const value = Number(year);
  if (year.length === 4) {
    return value;
  }
  return value <= 69 ? 2000 + value : 1900 + value;
}

function valid(parts: DateParts): DateParts | null {
  const { day, month } = parts;
  return month >= 1 && month <= 12 && day >= 1 && day <= 31 ? parts : null;
}

/** Parses text that is exactly one date, or returns null. */
export function parseDateParts(text: string, order: NumericDateOrder): DateParts | null {
  const value = foldText(text.trim());

  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return valid({ year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) });
  }

  const numeric = value.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{4}|\d{2}))?$/);
  if (numeric) {
    const [first, second] = [Number(numeric[1]), Number(numeric[2])];
    const [day, month] = order === 'mdy' ? [second, first] : [first, second];
    return valid({ day, month, year: fullYear(numeric[3]) });
  }

  const dayFirst = value.match(/^(\d{1,2})(?:er)?\s+([a-z]+)\.?,?(?:\s+(\d{4}|\d{2}))?$/);
  if (dayFirst) {
    const month = monthFromName(dayFirst[2]);
    return month ? valid({ day: Number(dayFirst[1]), month, year: fullYear(dayFirst[3]) }) : null;
  }

  // "Sep 3", "Sep 3, 2025", and "September 7,2017" as OCR reads it.
  const monthFirst = value.match(/^([a-z]+)\.?\s+(\d{1,2})(?:,?\s+(\d{4})|,(\d{4}))?,?$/);
  if (monthFirst) {
    const month = monthFromName(monthFirst[1]);
    const year = fullYear(monthFirst[3] ?? monthFirst[4]);
    return month ? valid({ day: Number(monthFirst[2]), month, year }) : null;
  }

  return null;
}

/**
 * "dmy" or "mdy" for numeric dates, decided by a component that can only be a
 * day ("17/01" is day-first, "09/13" month-first). Null when nothing decides.
 */
export function detectNumericDateOrder(samples: string[]): NumericDateOrder | null {
  let dayFirst = false;
  let monthFirst = false;
  for (const sample of samples) {
    for (const match of sample.matchAll(/\b(\d{1,2})[./](\d{1,2})(?:[./]\d{2,4})?\b/g)) {
      dayFirst ||= Number(match[1]) > 12 && Number(match[2]) <= 12;
      monthFirst ||= Number(match[2]) > 12 && Number(match[1]) <= 12;
    }
  }
  if (dayFirst === monthFirst) {
    return null;
  }
  return dayFirst ? 'dmy' : 'mdy';
}

const FULL_DATE_PATTERNS = [
  /\b\d{4}-\d{2}-\d{2}\b/g,
  /\b\d{1,2}[./-]\d{1,2}[./-](?:\d{4}|\d{2})\b/g,
  /\b\d{1,2}(?:er)?\s+[a-z]+\.?\s+\d{4}\b/g,
  /\b[a-z]+\.?\s+\d{1,2}(?:,?\s+|,)\d{4}\b/g,
];

export interface FoundDate {
  date: Date;
  index: number;
  length: number;
}

/** Every date with a year in free text, in order of appearance. */
export function findFullDates(text: string, order: NumericDateOrder): FoundDate[] {
  const folded = foldText(text);
  const found: FoundDate[] = [];
  for (const pattern of FULL_DATE_PATTERNS) {
    for (const match of folded.matchAll(pattern)) {
      const index = match.index ?? 0;
      const overlaps = found.some(
        f => index < f.index + f.length && f.index < index + match[0].length,
      );
      const parts = overlaps ? null : parseDateParts(match[0], order);
      if (parts?.year) {
        found.push({ date: toDate(parts, parts.year), index, length: match[0].length });
      }
    }
  }
  return found.sort((a, b) => a.index - b.index);
}

function toDate(parts: DateParts, year: number): Date {
  return new Date(year, parts.month - 1, parts.day);
}

/**
 * A date without a year takes the year of the statement's latest printed
 * date, or the year before when that would put it more than a month past it
 * (a December row on a statement closed in January).
 */
export function resolveDate(parts: DateParts, anchor: Date | null): Date {
  if (parts.year) {
    return toDate(parts, parts.year);
  }
  const year = anchor?.getFullYear() ?? new Date().getFullYear();
  const date = toDate(parts, year);
  const monthMs = 31 * 24 * 60 * 60 * 1000;
  return anchor && date.getTime() - anchor.getTime() > monthMs ? toDate(parts, year - 1) : date;
}
