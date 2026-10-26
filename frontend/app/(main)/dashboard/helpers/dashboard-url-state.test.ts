import { describe, expect, it } from 'vitest';
import {
  formatMonthParam,
  isFutureMonth,
  parseMonthParam,
  withDashboardParams,
} from './dashboard-url-state';

describe('dashboard-url-state', () => {
  it('parses YYYY-MM into the first of the month and rejects garbage', () => {
    expect(parseMonthParam('2026-03')?.getTime()).toBe(new Date(2026, 2, 1).getTime());
    expect(parseMonthParam('2026-13')).toBeNull();
    expect(parseMonthParam('2026-3')).toBeNull();
    expect(parseMonthParam('march')).toBeNull();
    expect(parseMonthParam(null)).toBeNull();
  });

  it('formats a date as YYYY-MM', () => {
    expect(formatMonthParam(new Date(2026, 0, 15))).toBe('2026-01');
    expect(formatMonthParam(new Date(2025, 11, 1))).toBe('2025-12');
  });

  it('patches the query string and removes keys set to null', () => {
    expect(withDashboardParams('tab=overview', { month: '2026-03' })).toBe(
      'tab=overview&month=2026-03',
    );
    expect(withDashboardParams('tab=overview&month=2026-03', { month: null })).toBe('tab=overview');
    expect(withDashboardParams('', { month: undefined })).toBe('');
  });

  it('detects future months relative to now', () => {
    const now = new Date(2026, 7, 15); // Aug 2026
    expect(isFutureMonth(2026, 8, now)).toBe(true);
    expect(isFutureMonth(2026, 7, now)).toBe(false);
    expect(isFutureMonth(2027, 0, now)).toBe(true);
    expect(isFutureMonth(2025, 11, now)).toBe(false);
  });
});
