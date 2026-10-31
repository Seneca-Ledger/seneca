const DAY_RANGE = /\b(\d{1,2})\s*-\s*(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\b/;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * A period printed as a day range in one month ("01 -30 Sep 2022"). Only the
 * first such range in the text counts. Null when there is none, the days run
 * backwards, the month is not an English one, or a day is not in that month.
 */
export function findDayRangePeriod(text: string): { from: Date; to: Date } | null {
  const match = DAY_RANGE.exec(text);
  if (!match) {
    return null;
  }
  const month = MONTHS.indexOf(match[3].slice(0, 3).toLowerCase());
  const [fromDay, toDay, year] = [Number(match[1]), Number(match[2]), Number(match[4])];
  if (month < 0 || fromDay > toDay) {
    return null;
  }
  const from = new Date(Date.UTC(year, month, fromDay));
  const to = new Date(Date.UTC(year, month, toDay));
  return from.getUTCMonth() === month && to.getUTCMonth() === month ? { from, to } : null;
}
