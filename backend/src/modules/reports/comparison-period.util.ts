import { previousPeriod } from './cash-flow-map.util';

/** Which earlier window a report is held against. */
export type CompareTo = 'previous' | 'year';

/**
 * The same dates a year earlier.
 *
 * Kept as dates rather than "365 days ago", so a yearly comparison lines up
 * month with month, which is what people mean by "versus last year".
 */
export function sameRangeLastYear(from: string, to: string): { from: string; to: string } {
  const shift = (date: string): string => {
    const [y, m, d] = date.split('-').map(Number);
    // 29 February has no counterpart in an ordinary year: it becomes 28 February.
    const lastDay = new Date(y - 1, m, 0).getDate();
    return `${y - 1}-${String(m).padStart(2, '0')}-${String(Math.min(d, lastDay)).padStart(2, '0')}`;
  };
  return { from: shift(from), to: shift(to) };
}

/** The earlier window for a period: the one just before it, or the same dates last year. */
export function comparisonPeriod(
  from: string,
  to: string,
  compareTo: CompareTo = 'previous',
): { from: string; to: string } {
  return compareTo === 'year' ? sameRangeLastYear(from, to) : previousPeriod(from, to);
}
