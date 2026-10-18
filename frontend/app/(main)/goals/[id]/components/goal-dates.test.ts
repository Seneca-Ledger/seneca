import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatGoalDate, formatGoalMonth, formatMonthCount } from './goal-dates';

describe('goal dates', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // The API sends date-only strings; read as UTC midnight they become the
  // previous day for anyone west of Greenwich.
  it('formats a date-only string as the same calendar day', () => {
    expect(formatGoalDate('2027-06-30', 'ru')).toContain('30 июня 2027');
    expect(formatGoalDate('2027-06-30', 'en')).toBe('June 30, 2027');
  });

  it('formats a month key as a month and year', () => {
    expect(formatGoalMonth('2027-03', 'en')).toBe('March 2027');
  });

  it('pluralises the month count by the locale rules', () => {
    expect(formatMonthCount(9, 'ru')).toBe('9 месяцев');
    expect(formatMonthCount(2, 'ru')).toBe('2 месяца');
    expect(formatMonthCount(1, 'en')).toBe('1 month');
  });
});
