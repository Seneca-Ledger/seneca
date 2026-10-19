import { InvoiceRecurrenceInterval } from '../../entities/invoice.entity';

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Adds whole months, keeping the day a client expects to be billed on.
 *
 * `setUTCMonth(+1)` on the 31st rolls over into the month after next — a
 * monthly invoice dated 31 January jumped to 3 March and February was never
 * billed at all. The day is therefore clamped to the length of the target
 * month, and the anchor day (the day the recurrence was set up on) is reapplied
 * every step so a February 28th does not permanently become the new anchor.
 */
function addMonths(from: Date, months: number, anchorDay: number): Date {
  const year = from.getUTCFullYear();
  const monthIndex = from.getUTCMonth() + months;
  const target = new Date(Date.UTC(year, monthIndex, 1));
  const day = Math.min(anchorDay, daysInMonth(target.getUTCFullYear(), target.getUTCMonth()));
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), day));
}

/**
 * The next date a recurring invoice's copy should be issued on.
 *
 * `anchorDate` is the recurrence's own issue date; pass it when advancing from a
 * date that was already clamped (29 February, a month-end), so the series keeps
 * billing on the day it was set up on.
 */
export function advanceIssueDate(
  issueDate: string,
  interval: InvoiceRecurrenceInterval,
  anchorDate: string = issueDate,
): string {
  const date = parseDateOnly(issueDate);
  const anchorDay = parseDateOnly(anchorDate).getUTCDate();

  switch (interval) {
    case InvoiceRecurrenceInterval.WEEKLY:
      date.setUTCDate(date.getUTCDate() + 7);
      return formatDateOnly(date);
    case InvoiceRecurrenceInterval.MONTHLY:
      return formatDateOnly(addMonths(date, 1, anchorDay));
    case InvoiceRecurrenceInterval.QUARTERLY:
      return formatDateOnly(addMonths(date, 3, anchorDay));
    case InvoiceRecurrenceInterval.YEARLY:
      return formatDateOnly(addMonths(date, 12, anchorDay));
  }
}

/** Keeps the same issue-to-due offset (in days) on a generated copy. */
export function shiftDueDate(
  oldIssueDate: string,
  oldDueDate: string,
  newIssueDate: string,
): string {
  const offsetDays = Math.round(
    (parseDateOnly(oldDueDate).getTime() - parseDateOnly(oldIssueDate).getTime()) / 86_400_000,
  );
  const due = parseDateOnly(newIssueDate);
  due.setUTCDate(due.getUTCDate() + offsetDays);
  return formatDateOnly(due);
}
