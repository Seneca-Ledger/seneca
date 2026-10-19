import { describe, expect, it, vi } from 'vitest';

import {
  DATE_PRESETS,
  DEFAULT_TABLES_REPORTS_FILTERS,
  formatAmount,
  getComparisonArrow,
  getComparisonColor,
  getSourceLabel,
  loadTablesReportsFilters,
  resolveDays,
  saveTablesReportsFilters,
} from './tables-reports.utils';

describe('tables reports helpers', () => {
  it('formats source labels and comparison helpers', () => {
    expect(getSourceLabel('manual')).toBe('Manual');
    expect(getComparisonColor('up')).toBe('text-emerald-600');
    expect(getComparisonColor('down')).toBe('text-red-500');
    expect(getComparisonColor('flat')).toBe('text-gray-400');
    expect(getComparisonArrow('up')).toBe('↑');
    expect(getComparisonArrow('down')).toBe('↓');
    expect(getComparisonArrow('flat')).toBe('–');
  });

  it('persists and restores filters from localStorage', () => {
    localStorage.clear();
    expect(loadTablesReportsFilters()).toEqual(DEFAULT_TABLES_REPORTS_FILTERS);

    saveTablesReportsFilters({
      tableIds: ['table-1'],
      days: 90,
      flowType: 'expense',
      sortBy: 'operations',
      search: 'vendor',
    });

    expect(loadTablesReportsFilters()).toEqual({
      tableIds: ['table-1'],
      days: 90,
      flowType: 'expense',
      sortBy: 'operations',
      search: 'vendor',
    });
  });

  it('formats amount and resolves date presets', () => {
    expect(formatAmount(1234.5, 'USD')).toBe('1,234.5 USD');
    expect(DATE_PRESETS.map((item: { value: number }) => item.value)).toEqual([7, 30, 90, 365, -1]);
    expect(resolveDays(30)).toBe(30);

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-01T12:00:00.000Z'));
    expect(resolveDays(-1)).toBe(91);
    vi.useRealTimers();
  });
});
