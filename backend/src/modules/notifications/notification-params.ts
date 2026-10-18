/**
 * Values a notification message is built from. Plain strings and numbers go in
 * as they are; the structured ones are formatted in the recipient's locale when
 * the message is rendered, so nobody reads "11.99 EUR" or "2026-10-12".
 */
export type NotificationParam =
  | string
  | number
  | { kind: 'money'; amount: number | string; currency: string }
  /** A calendar day, YYYY-MM-DD (or a Date, as `date` columns are typed). */
  | { kind: 'date'; value: string | Date }
  | { kind: 'dateRange'; start: string; end: string }
  /** ISO 3166 country code, shown as the country's name. */
  | { kind: 'region'; code: string }
  /** A tax period: "Q3", "September", "2025" — with the year when it is not this one. */
  | { kind: 'taxPeriod'; start: string; end: string }
  /** "Dropbox €11.99 and Adobe Creative Cloud €66.45". */
  | {
      kind: 'charges';
      items: Array<{ name: string; amount: number | string; currency: string }>;
    };

export type NotificationParams = Record<string, NotificationParam>;

/** How a quarter is written; {{n}} is 1–4, {{roman}} is I–IV. */
const QUARTER_LABELS: Record<string, string> = {
  en: 'Q{{n}}',
  ru: '{{n}}-й квартал',
  kk: '{{n}}-тоқсан',
  de: 'Q{{n}}',
  fr: 'T{{n}}',
  es: '{{n}}T',
  pt: '{{n}}.º trimestre',
  tr: '{{n}}. çeyrek',
  uk: '{{n}}-й квартал',
  zh: '第{{n}}季度',
  pl: '{{roman}} kwartał',
  it: '{{n}}° trimestre',
  sk: '{{n}}. štvrťrok',
  ja: '第{{n}}四半期',
  ko: '{{n}}분기',
  hi: 'तिमाही {{n}}',
  nl: '{{n}}e kwartaal',
  sv: 'kvartal {{n}}',
  vi: 'quý {{n}}',
  id: 'triwulan {{roman}}',
  da: '{{n}}. kvartal',
  nb: '{{n}}. kvartal',
  nn: '{{n}}. kvartal',
  fi: '{{n}}. neljännes',
  is: '{{n}}. ársfjórðungur',
  fo: '{{n}}. ársfjórðingur',
  cs: '{{n}}. čtvrtletí',
  bg: '{{roman}} тримесечие',
  hr: '{{n}}. tromjesečje',
  sr: '{{n}}. квартал',
  sl: '{{n}}. četrtletje',
  mk: '{{roman}} квартал',
  be: '{{roman}} квартал',
  bs: '{{n}}. kvartal',
  hsb: '{{n}}. kwartal',
};

/** Where the year does not simply follow the quarter. */
const QUARTER_WITH_YEAR: Record<string, string> = {
  zh: '{{year}}年第{{n}}季度',
  ja: '{{year}}年第{{n}}四半期',
  ko: '{{year}}년 {{n}}분기',
};

const ROMAN = ['I', 'II', 'III', 'IV'];

function safeLocale(locale: string): string {
  try {
    return Intl.getCanonicalLocales(locale)[0] ?? 'en';
  } catch {
    return 'en';
  }
}

function dayOf(value: string | Date): Date {
  const iso = typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
  return new Date(`${iso}T00:00:00Z`);
}

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(values[key] ?? ''));
}

export function formatMoney(amount: number | string, currency: string, locale: string): string {
  const value = Number(amount);
  try {
    return new Intl.NumberFormat(safeLocale(locale), { style: 'currency', currency }).format(value);
  } catch {
    // An unknown currency code: still say how much and of what.
    return `${value.toFixed(2)} ${currency}`;
  }
}

/** "Oct 12" this year, "Oct 12, 2025" otherwise. */
export function formatDay(value: string | Date, locale: string, now: Date): string {
  const day = dayOf(value);
  return new Intl.DateTimeFormat(safeLocale(locale), {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    ...(day.getUTCFullYear() === now.getUTCFullYear() ? {} : { year: 'numeric' }),
  }).format(day);
}

/** "Jul 1 – Sep 30", with the year when the range is not within this one. */
export function formatDayRange(start: string, end: string, locale: string, now: Date): string {
  const from = dayOf(start);
  const to = dayOf(end);
  const thisYear = now.getUTCFullYear();
  return new Intl.DateTimeFormat(safeLocale(locale), {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    ...(from.getUTCFullYear() === thisYear && to.getUTCFullYear() === thisYear
      ? {}
      : { year: 'numeric' }),
  }).formatRange(from, to);
}

/** "Q3" for a quarter, the month's name for a month, the year for a year. */
export function formatTaxPeriod(start: string, end: string, locale: string, now: Date): string {
  const from = dayOf(start);
  const to = dayOf(end);
  const year = from.getUTCFullYear();
  const months = (to.getUTCFullYear() - year) * 12 + to.getUTCMonth() - from.getUTCMonth() + 1;
  const otherYear = year !== now.getUTCFullYear();
  const language = safeLocale(locale).split('-')[0];

  if (months === 12 && from.getUTCMonth() === 0) {
    return String(year);
  }
  if (months === 1) {
    return new Intl.DateTimeFormat(safeLocale(locale), {
      month: 'long',
      timeZone: 'UTC',
      ...(otherYear ? { year: 'numeric' } : {}),
    }).format(from);
  }
  if (months === 3 && from.getUTCMonth() % 3 === 0) {
    const n = from.getUTCMonth() / 3 + 1;
    const label = QUARTER_LABELS[language] ?? QUARTER_LABELS.en;
    const values = { n, roman: ROMAN[n - 1], year };
    if (!otherYear) {
      return fill(label, values);
    }
    return fill(QUARTER_WITH_YEAR[language] ?? `${label} {{year}}`, values);
  }
  return formatDayRange(start, end, locale, now);
}

export function formatRegion(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([safeLocale(locale)], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function formatParam(
  param: NotificationParam | undefined,
  locale: string,
  now: Date,
): string {
  if (param === undefined || param === null) {
    return '';
  }
  if (typeof param !== 'object') {
    return String(param);
  }
  switch (param.kind) {
    case 'money':
      return formatMoney(param.amount, param.currency, locale);
    case 'date':
      return formatDay(param.value, locale, now);
    case 'dateRange':
      return formatDayRange(param.start, param.end, locale, now);
    case 'region':
      return formatRegion(param.code, locale);
    case 'taxPeriod':
      return formatTaxPeriod(param.start, param.end, locale, now);
    case 'charges':
      return new Intl.ListFormat(safeLocale(locale), { type: 'conjunction' }).format(
        param.items.map(item => `${item.name} ${formatMoney(item.amount, item.currency, locale)}`),
      );
  }
}
