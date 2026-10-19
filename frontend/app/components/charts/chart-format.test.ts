import { describe, expect, it } from 'vitest';
import {
  computeYearTicks,
  formatDayLabel,
  formatMonthLabel,
  formatSignedAmount,
  monthAtIndex,
} from './chart-format';

describe('monthAtIndex', () => {
  const points = [{ month: '2026-01' }, { month: '2026-02' }];

  it('maps a Recharts active index (number or string) to the month key', () => {
    expect(monthAtIndex(points, 1)).toBe('2026-02');
    expect(monthAtIndex(points, '0')).toBe('2026-01');
  });

  it('ignores clicks that did not land on a point', () => {
    expect(monthAtIndex(points, undefined)).toBeUndefined();
    expect(monthAtIndex(points, null)).toBeUndefined();
    expect(monthAtIndex(points, '')).toBeUndefined();
    expect(monthAtIndex(points, 5)).toBeUndefined();
  });
});

describe('computeYearTicks', () => {
  it('is empty when every key is in the same year', () => {
    expect(computeYearTicks(['2026-01', '2026-02', '2026-12'])).toEqual([]);
  });

  it('marks the first key of each new year', () => {
    expect(computeYearTicks(['2024-11', '2024-12', '2025-01', '2025-02', '2026-01'])).toEqual([
      '2025-01',
      '2026-01',
    ]);
  });

  it('works for daily keys whose year starts mid-series without a Jan 1 point', () => {
    expect(computeYearTicks(['2025-12-20', '2025-12-27', '2026-01-03'])).toEqual(['2026-01-03']);
  });

  it('handles empty and single-point series', () => {
    expect(computeYearTicks([])).toEqual([]);
    expect(computeYearTicks(['2026-03'])).toEqual([]);
  });
});

describe('labels', () => {
  it('formats month and day keys in local time', () => {
    expect(formatMonthLabel('2025-08', 'en-US')).toBe('Aug 2025');
    expect(formatDayLabel('2026-01-01', 'en-US')).toBe('Jan 1, 2026');
  });

  it('prefixes the sign and formats the magnitude', () => {
    const format = (value: number) => `$${value}`;
    expect(formatSignedAmount(26731, format)).toBe('+$26731');
    expect(formatSignedAmount(-40, format)).toBe('−$40');
    expect(formatSignedAmount(0, format)).toBe('+$0');
  });
});
