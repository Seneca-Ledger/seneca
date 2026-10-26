/** `YYYY-MM` of the month the reader is in, by their own calendar. */
export function currentMonthKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * The day a figure for a `YYYY-MM` month is measured on: its last day, or null
 * for the month we are in, which is measured today like everywhere else.
 */
export function monthEndOrToday(month: string, now: Date = new Date()): string | null {
  if (month === currentMonthKey(now)) {
    return null;
  }
  const [year, index] = month.split('-').map(Number);
  return `${month}-${String(new Date(year, index, 0).getDate()).padStart(2, '0')}`;
}
