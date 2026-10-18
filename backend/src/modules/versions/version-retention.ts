/**
 * Which past versions of a workspace to let go of: every day for the last
 * month, then one a week for half a year, then one a month for good. The
 * version kept for a day, week or month is its newest one. Days, weeks and
 * months are the owner's, read in their time zone.
 */

export interface RetainedVersion {
  id: string;
  takenAt: Date;
  status: 'running' | 'ready' | 'failed';
}

export interface RetentionPolicy {
  dailyDays: number;
  weeklyWeeks: number;
  /** How long a failed attempt stays listed, so the owner can see it failed. */
  failedDays: number;
}

export const DEFAULT_RETENTION: RetentionPolicy = { dailyDays: 30, weeklyWeeks: 26, failedDays: 7 };

const DAY_MS = 24 * 60 * 60 * 1000;

/** The calendar day a moment falls on in a time zone, as `YYYY-MM-DD`. */
export function localDay(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/** The ISO week of a `YYYY-MM-DD` day, as `YYYY-Www`; the year is the week's own. */
export function isoWeek(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, date));
  // Thursday decides which year a week belongs to.
  const weekday = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - weekday);
  const weekYear = utc.getUTCFullYear();
  const week = Math.ceil(((utc.getTime() - Date.UTC(weekYear, 0, 1)) / DAY_MS + 1) / 7);
  return `${weekYear}-W${String(week).padStart(2, '0')}`;
}

/**
 * The ids to delete. Never the newest ready version, a running one, or one in
 * `protectedIds` (opened a moment ago); a failed one goes after `failedDays`.
 */
export function selectVersionsToDelete(
  versions: RetainedVersion[],
  now: Date,
  timeZone: string,
  protectedIds: ReadonlySet<string> = new Set(),
  policy: RetentionPolicy = DEFAULT_RETENTION,
): string[] {
  const doomed: string[] = [];
  const ready = versions
    .filter(version => version.status === 'ready')
    .sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime());
  const kept = new Set<string>();

  ready.forEach((version, index) => {
    const ageDays = (now.getTime() - version.takenAt.getTime()) / DAY_MS;
    const day = localDay(version.takenAt, timeZone);
    const bucket =
      ageDays < policy.dailyDays
        ? `day:${day}`
        : ageDays < policy.dailyDays + policy.weeklyWeeks * 7
          ? `week:${isoWeek(day)}`
          : `month:${day.slice(0, 7)}`;
    // Newest first: the first version seen in a bucket is the one it keeps.
    if (index === 0 || !kept.has(bucket) || protectedIds.has(version.id)) {
      kept.add(bucket);
    } else {
      doomed.push(version.id);
    }
  });

  for (const version of versions) {
    if (
      version.status === 'failed' &&
      !protectedIds.has(version.id) &&
      now.getTime() - version.takenAt.getTime() > policy.failedDays * DAY_MS
    ) {
      doomed.push(version.id);
    }
  }
  return doomed;
}
