import { SubscriptionFrequency } from '../../entities/subscription.entity';

const bucketOf = (date: Date): number => date.getFullYear() * 12 + date.getMonth();

/** ~380 years of weekly charges: only a corrupt row can reach this. */
const MAX_STEPS = 20000;

/**
 * The n-th charge after the anchor date.
 *
 * Addressed by index rather than by repeatedly adding an interval, because
 * `Date.setMonth` overflows: stepping month by month from Jan 31 yields Mar 3
 * and skips February entirely, which would punch a hole in the calendar for
 * every subscription billed on the 29th-31st. Here the day is clamped to the
 * length of the target month instead, so a monthly subscription charges in
 * every month and an annual one on Feb 29 falls back to Feb 28.
 */
export function chargeAt(anchor: Date, frequency: SubscriptionFrequency, index: number): Date {
  if (frequency === SubscriptionFrequency.WEEKLY) {
    const weekly = new Date(anchor);
    weekly.setDate(weekly.getDate() + 7 * index);
    return weekly;
  }

  const monthStep =
    frequency === SubscriptionFrequency.MONTHLY
      ? 1
      : frequency === SubscriptionFrequency.QUARTERLY
        ? 3
        : 12;

  const target = bucketOf(anchor) + monthStep * index;
  const year = Math.floor(target / 12);
  const month = target % 12;
  // Day 0 of the next month is the last day of this one.
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(anchor.getDate(), daysInMonth));
}

/**
 * How many charges of one subscription land in each of the next `months`
 * calendar months, starting with the month `from` falls in.
 *
 * Deliberately not the service's `normalizeToMonthly`: that smears an annual
 * charge across twelve months, while a calendar has to place it in the single
 * month it is actually billed. A weekly subscription lands 4 or 5 times
 * depending on the month, which is exactly what the calendar should show.
 */
export function projectMonthlyCharges(
  nextChargeDate: Date | null,
  frequency: SubscriptionFrequency,
  from: Date,
  months: number,
): number[] {
  const buckets = new Array<number>(Math.max(0, months)).fill(0);
  if (!nextChargeDate || months <= 0) return buckets;

  const anchor = new Date(nextChargeDate);
  if (Number.isNaN(anchor.getTime())) return buckets;

  const first = bucketOf(from);
  const last = first + months - 1;

  // Starts at index 0 so a stale nextChargeDate (the daily cron has not rolled
  // it forward yet) is caught up rather than dropped.
  for (let index = 0; index < MAX_STEPS; index += 1) {
    const bucket = bucketOf(chargeAt(anchor, frequency, index));
    if (bucket > last) break;
    if (bucket >= first) buckets[bucket - first] += 1;
  }

  return buckets;
}
