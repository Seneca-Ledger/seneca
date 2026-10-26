/**
 * Daily series over balance snapshots, shared by every page that charts a
 * line's value over time (net worth, investment returns). A snapshot is a
 * value entered — or written by a price refresh — on one day; it holds until
 * the next one.
 */

/** The window presets that count back a fixed number of days from today. */
export const RANGE_DAYS = {
  '1d': 1,
  '30d': 30,
  '90d': 90,
  '180d': 180,
  '1y': 365,
  '3y': 365 * 3,
  '5y': 365 * 5,
} as const;

export type FixedRange = keyof typeof RANGE_DAYS;

interface DatedSnapshot {
  accountId: string;
  snapshotDate: Date | string;
}

/**
 * Start of a preset window ending on `to`. `all` is not here: where the
 * history begins depends on the data, which only the caller can ask.
 */
export function presetWindowStart(range: FixedRange | 'ytd', to: string): string {
  if (range === 'ytd') {
    return `${to.slice(0, 4)}-01-01`;
  }
  return shiftDays(to, -RANGE_DAYS[range]);
}

export function groupSnapshots<T extends DatedSnapshot>(snapshots: T[]): Map<string, T[]> {
  const byAccount = new Map<string, T[]>();
  for (const snapshot of snapshots) {
    const bucket = byAccount.get(snapshot.accountId);
    if (bucket) {
      bucket.push(snapshot);
    } else {
      byAccount.set(snapshot.accountId, [snapshot]);
    }
  }
  return byAccount;
}

/**
 * Forward fill: an account holds its last entered value until the next one.
 * Binary search rather than a scan — this runs once per account per day.
 * Expects the snapshots in date order.
 */
export function latestOnOrBefore<T extends DatedSnapshot>(
  snapshots: T[] | undefined,
  date: string,
): T | null {
  if (!snapshots || snapshots.length === 0) {
    return null;
  }
  let low = 0;
  let high = snapshots.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (isoDate(new Date(snapshots[middle].snapshotDate)) <= date) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found >= 0 ? snapshots[found] : null;
}

/** Every day from `from` to `to`, inclusive of both ends. */
export function everyDay(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let date = from; date <= to; date = shiftDays(date, 1)) {
    dates.push(date);
  }
  return dates.length > 0 ? dates : [to];
}

/**
 * At most `limit` of the daily points, keeping both ends and, inside each
 * bucket in between, the lowest and the highest day.
 *
 * Even sampling is exactly what hides a one-day crash on a ten-year chart: it
 * only ever shows the days it happens to land on. Keeping the extremes of
 * each bucket means a spike survives at every zoom level, which is the whole
 * reason to look at the chart.
 */
export function decimate<T extends { date: string; value: number }>(
  points: T[],
  limit: number,
): T[] {
  if (points.length <= limit) {
    return points;
  }

  const inner = points.slice(1, -1);
  const buckets = Math.max(1, Math.floor((limit - 2) / 2));
  const size = inner.length / buckets;
  const kept: T[] = [points[0]];

  for (let bucket = 0; bucket < buckets; bucket += 1) {
    const slice = inner.slice(Math.floor(bucket * size), Math.floor((bucket + 1) * size));
    for (const point of extremes(slice)) {
      if (kept[kept.length - 1].date !== point.date) {
        kept.push(point);
      }
    }
  }

  kept.push(points[points.length - 1]);
  return kept;
}

/** The lowest and the highest point of a slice, in the order they happened. */
function extremes<T extends { date: string; value: number }>(points: T[]): T[] {
  if (points.length === 0) {
    return [];
  }
  let lowest = points[0];
  let highest = points[0];
  for (const point of points) {
    if (point.value < lowest.value) {
      lowest = point;
    }
    if (point.value > highest.value) {
      highest = point;
    }
  }
  return lowest.date <= highest.date ? [lowest, highest] : [highest, lowest];
}

export function minDate(left: string, right: string): string {
  return left <= right ? left : right;
}

export function maxDate(left: string, right: string): string {
  return left >= right ? left : right;
}

export function isoDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function shiftDays(date: string, days: number): string {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);
  return isoDate(shifted);
}
