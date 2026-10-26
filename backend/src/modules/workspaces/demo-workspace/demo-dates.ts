/**
 * Calendar arithmetic for the demo data, on plain `YYYY-MM-DD` strings in UTC
 * so the result does not depend on the server's time zone.
 */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Validates `YYYY-MM-DD` as a real calendar date. */
export function isDateOnly(value: string): boolean {
  const match = DATE_ONLY.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
}

export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** First day of the month `offset` months from the anchor's month, as `YYYY-MM`. */
export function monthFrom(anchor: string, offset: number): string {
  const year = Number(anchor.slice(0, 4));
  const month = Number(anchor.slice(5, 7)) - 1 + offset;
  return toDateOnly(new Date(Date.UTC(year, month, 1))).slice(0, 7);
}

export function daysInMonth(month: string): number {
  return new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
}

/** A day of a `YYYY-MM` month, clamped to the month's length (the 31st of June is the 30th). */
export function dayOf(month: string, day: number): string {
  return `${month}-${String(Math.min(day, daysInMonth(month))).padStart(2, '0')}`;
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return toDateOnly(value);
}

/** The calendar quarter (1–4) of a `YYYY-MM` month. */
export function quarterOf(month: string): number {
  return Math.floor((Number(month.slice(5, 7)) - 1) / 3) + 1;
}
