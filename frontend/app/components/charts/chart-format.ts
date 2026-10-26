/*
 * Chart design adapted from Aurum by ZProger (https://github.com/ZProger/Aurum).
 * Reimplemented for Seneca; no Aurum source code was copied.
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

/** Round steps an axis ceiling may land on, within one power of ten. */
const NICE_CEILINGS = [1, 2, 2.5, 5, 10];
/** The lines under the ceiling: a 1-2-5 ladder reads like a ruler on a compressed scale. */
const LADDER = [1, 2, 5];

/** The smallest round number at or over `value` ($1,942 → $2,000; $850 → $1,000). */
export function niceCeiling(value: number): number {
  if (!(value > 0)) {
    return 0;
  }
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = NICE_CEILINGS.find(nice => nice * magnitude >= value) ?? 10;
  return Number((step * magnitude).toPrecision(12));
}

/** The largest 1-2-5 number at or under `value` ($15 → $10; $340 → $200). */
function ladderFloor(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [...LADDER].reverse().find(nice => nice * magnitude <= value) ?? 1;
  return Number((step * magnitude).toPrecision(12));
}

export interface CompressedAxis {
  /** Where the grid lines go, in amounts: 0, round rungs from the typical spend, the ceiling. */
  ticks: number[];
  /**
   * An amount's height on the axis, where tick `i` sits at exactly `i`: the chart draws
   * `toY(value)`, never the value itself.
   */
  toY: (value: number) => number;
}

/**
 * A money axis that keeps small spending visible next to a month's income, with evenly
 * spaced lines on round amounts: 0, then a 1-2-5 ladder from the typical spend (`typical`),
 * then `ceiling`. Each band between two lines is the same height and fills linearly, so a
 * $15 coffee and a $1,900 salary both read.
 *
 * At most `maxLines` lines in all: the rungs that sit nearest to even steps on a log-like
 * curve stay. A rung over half the ceiling is left out: it would stretch a thin slice of
 * money ($2,000 to $2,500) over a whole band.
 */
export function compressedAxis(ceiling: number, typical: number, maxLines = 7): CompressedAxis {
  if (!(ceiling > 0)) {
    return { ticks: [0], toY: () => 0 };
  }
  // Never more than three decades of lines, whatever the smallest spend.
  const floor = ladderFloor(Math.min(Math.max(typical, ceiling / 1000), ceiling / 2));
  const curve = (value: number): number => Math.log1p(Math.max(0, value) / floor);
  const ladder = [0];
  for (let magnitude = 10 ** Math.floor(Math.log10(floor)); ; magnitude *= 10) {
    const rungs = LADDER.map(nice => Number((nice * magnitude).toPrecision(12)));
    ladder.push(...rungs.filter(rung => rung >= floor && rung <= ceiling / 2));
    if (rungs[0] * 10 >= ceiling) {
      break;
    }
  }
  ladder.push(ceiling);
  const ticks = evenlyPicked(ladder, curve, maxLines);

  const toY = (value: number): number => {
    const amount = Math.min(Math.max(0, value), ceiling);
    const band = Math.max(
      0,
      ticks.findLastIndex(tick => tick <= amount),
    );
    if (band >= ticks.length - 1) {
      return ticks.length - 1;
    }
    return band + (amount - ticks[band]) / (ticks[band + 1] - ticks[band]);
  };
  return { ticks, toY };
}

/** Keeps the first and last tick and the inner ones nearest to `count` even heights. */
function evenlyPicked(ticks: number[], curve: (value: number) => number, count: number): number[] {
  if (ticks.length <= count) {
    return ticks;
  }
  const inner = ticks.slice(1, -1);
  const height = curve(ticks[ticks.length - 1]);
  const picked = new Set<number>();
  for (let slot = 1; slot < count - 1; slot++) {
    const target = (height * slot) / (count - 1);
    const nearest = inner
      .filter(tick => !picked.has(tick))
      .reduce((best, tick) =>
        Math.abs(curve(tick) - target) < Math.abs(curve(best) - target) ? tick : best,
      );
    picked.add(nearest);
  }
  return [ticks[0], ...inner.filter(tick => picked.has(tick)), ticks[ticks.length - 1]];
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

/** `+1 200 ₸` / `−300 ₸` — the magnitude goes through the caller's currency formatter. */
export function formatSignedAmount(value: number, formatAmount: (value: number) => string): string {
  return `${value >= 0 ? '+' : '−'}${formatAmount(Math.abs(value))}`;
}
