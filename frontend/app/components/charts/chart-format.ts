/*
 * Chart design adapted from Aurum by ZProger (https://github.com/ZProger/Aurum).
 * Reimplemented for Lumio; no Aurum source code was copied.
 */

/**
 * Keys (`YYYY-MM` or `YYYY-MM-DD`, ascending) where a new calendar year starts. Charts show an
 * X axis only for these year landmarks, so the list is empty when the data sits inside one year.
 */
export function computeYearTicks(keys: readonly string[]): string[] {
  const ticks: string[] = [];
  for (let index = 1; index < keys.length; index++) {
    if (keys[index].slice(0, 4) !== keys[index - 1].slice(0, 4)) {
      ticks.push(keys[index]);
    }
  }
  return ticks;
}

/** Local-time date for a `YYYY-MM` or `YYYY-MM-DD` key (no UTC shift). */
function parseKey(key: string): Date {
  const [year, month = 1, day = 1] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatMonthLabel(key: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(parseKey(key));
}

/** An axis amount without its currency ("1.2K"): the figure above the chart names it. */
export function formatAxisAmount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  );
}

/** The month alone ("Oct"), for an axis whose years are marked apart. */
export function formatShortMonthLabel(key: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short' }).format(parseKey(key));
}

export function formatDayLabel(key: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parseKey(key));
}

/** `3 Oct` — no year, for dense X axis ticks on a daily chart. */
export function formatShortDayLabel(key: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(parseKey(key));
}

/** The `month` of the point a chart click landed on (Recharts reports its index), if any. */
export function monthAtIndex(
  points: ReadonlyArray<{ month: string }>,
  index: unknown,
): string | undefined {
  const isIndex = typeof index === 'number' || (typeof index === 'string' && index !== '');
  const position = isIndex ? Number(index) : Number.NaN;
  return Number.isInteger(position) ? points[position]?.month : undefined;
}

/** `+1 200 ₸` / `−300 ₸` — the magnitude goes through the caller's currency formatter. */
export function formatSignedAmount(value: number, formatAmount: (value: number) => string): string {
  return `${value >= 0 ? '+' : '−'}${formatAmount(Math.abs(value))}`;
}
