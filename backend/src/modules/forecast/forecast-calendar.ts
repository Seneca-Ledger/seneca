import { formatDateOnly } from './forecast.engine';

/** Whole calendar months from one YYYY-MM-DD to another, days ignored. */
export function monthsUntil(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

export function firstOfNextMonth(date: string): string {
  const [y, m] = date.split('-').map(Number);
  return formatDateOnly(new Date(y, m, 1));
}
