import { describe, expect, it } from 'vitest';
import {
  formatMonthParam,
  isFutureMonth,
  parseCashFlowRangeParam,
  parseMonthParam,
  parseTabParam,
  withDashboardParams,
} from './dashboard-url-state';

describe('dashboard-url-state', () => {
  it('parses the cash flow range and falls back to 12 months', () => {
    expect(parseCashFlowRangeParam('5y')).toBe('5y');
    expect(parseCashFlowRangeParam('all')).toBe('all');
    expect(parseCashFlowRangeParam('this_year')).toBe('this_year');
    expect(parseCashFlowRangeParam('30d')).toBe('12m');
    expect(parseCashFlowRangeParam(null)).toBe('12m');
  });

  it('patches the cash flow range alongside the other keys', () => {
    expect(withDashboardParams('tab=trends', { cf: 'all' })).toBe('tab=trends&cf=all');
    expect(withDashboardParams('tab=trends&cf=all', { cf: null })).toBe('tab=trends');
  });

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

  it('falls back to overview for unknown tabs', () => {
    expect(parseTabParam('trends')).toBe('trends');
    expect(parseTabParam('data-health')).toBe('data-health');
    expect(parseTabParam('nope')).toBe('overview');
    expect(parseTabParam(null)).toBe('overview');
  });

  it('patches the query string and removes keys set to null', () => {
    expect(withDashboardParams('tab=trends', { month: '2026-03' })).toBe(
      'tab=trends&month=2026-03',
    );
    expect(withDashboardParams('tab=trends&month=2026-03', { tab: null })).toBe('month=2026-03');
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
