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

/**
 * The charges of one subscription in the calendar month `today` falls in, split
 * by date: on or before today counts as paid, after it as still to pay.
 *
 * Walks back from the next charge as well as forward, because the daily cron
 * has already rolled `nextChargeDate` past the charges made earlier this month.
 */
export function splitMonthCharges(
  nextChargeDate: Date | null,
  frequency: SubscriptionFrequency,
  today: Date,
): { paid: number; unpaid: number } {
  const split = { paid: 0, unpaid: 0 };
  if (!nextChargeDate) return split;

  const anchor = new Date(nextChargeDate);
  if (Number.isNaN(anchor.getTime())) return split;

  const month = bucketOf(today);
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const count = (charge: Date): void => {
    if (charge < endOfToday) split.paid += 1;
    else split.unpaid += 1;
  };

  for (let index = -1; index > -MAX_STEPS; index -= 1) {
    const charge = chargeAt(anchor, frequency, index);
    if (bucketOf(charge) < month) break;
    if (bucketOf(charge) === month) count(charge);
  }
  // Forward from the anchor itself; a stale one in an earlier month is caught up.
  for (let index = 0; index < MAX_STEPS; index += 1) {
    const charge = chargeAt(anchor, frequency, index);
    if (bucketOf(charge) > month) break;
    if (bucketOf(charge) === month) count(charge);
  }

  return split;
}

/**
 * How many charges of one subscription fall between two days, both included,
 * stepping from its next charge as the calendar does, less the ones in `paid`
 * (`YYYY-MM-DD` days already covered by a payment made ahead of them). A
 * `date` column arrives as `YYYY-MM-DD` and is read as that local day.
 */
export function countChargesBetween(
  nextChargeDate: Date | string | null,
  frequency: SubscriptionFrequency,
  from: Date,
  to: Date,
  paid: ReadonlySet<string> = new Set(),
): number {
  if (!nextChargeDate) return 0;
  const anchor =
    typeof nextChargeDate === 'string'
      ? localDayOf(nextChargeDate)
      : new Date(nextChargeDate.getFullYear(), nextChargeDate.getMonth(), nextChargeDate.getDate());
  if (Number.isNaN(anchor.getTime())) return 0;
  const first = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const last = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();

  let count = 0;
  for (let index = 0; index < MAX_STEPS; index += 1) {
    const charge = chargeAt(anchor, frequency, index);
    const at = charge.getTime();
    if (at > last) break;
    if (at >= first && !paid.has(dayKey(charge))) count += 1;
  }
  return count;
}

function localDayOf(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}
