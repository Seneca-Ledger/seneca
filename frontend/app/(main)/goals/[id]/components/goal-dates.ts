import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';

/**
 * `YYYY-MM-DD` as the reader's date, e.g. "30 июня 2027 г.". Built from the
 * parts because `new Date('2027-06-30')` is UTC midnight, which is the 29th
 * anywhere west of Greenwich.
 */
export function formatGoalDate(isoDate: string, locale: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number);
  return formatStoredDateWithOptions(
    new Date(year, month - 1, day),
    { day: 'numeric', month: 'long', year: 'numeric' },
    locale,
  );
}

/** `YYYY-MM` as a month the reader recognises, e.g. "октябрь 2026". */
export function formatGoalMonth(month: string, locale: string): string {
  const [year, index] = month.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(
    new Date(year, index - 1, 1),
  );
}

/** "9 месяцев", "1 month": ICU carries the plural rules of every locale. */
export function formatMonthCount(count: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'month',
    unitDisplay: 'long',
  }).format(count);
}
