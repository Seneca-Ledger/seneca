import { describe, expect, it } from 'vitest';
import {
  computeYearTicks,
  formatDayLabel,
  formatMonthLabel,
  formatSignedAmount,
  compressedAxis,
  niceCeiling,
} from './chart-format';

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

describe('niceCeiling', () => {
  it("rounds the month's income up to a round ceiling", () => {
    expect(niceCeiling(1942)).toBe(2000);
    expect(niceCeiling(850)).toBe(1000);
    expect(niceCeiling(2100)).toBe(2500);
    expect(niceCeiling(0)).toBe(0);
  });
});

describe('compressedAxis', () => {
  it('puts round amounts on the lines, from the typical spend up to the ceiling', () => {
    expect(compressedAxis(2000, 15).ticks).toEqual([0, 10, 50, 100, 500, 1000, 2000]);
  });

  it('spaces every line the same distance apart', () => {
    for (const [ceiling, typical] of [
      [2000, 15],
      [2500, 15],
      [2000, 5],
      [25_000, 340],
      [100, 90],
    ]) {
      const { ticks, toY } = compressedAxis(ceiling, typical);
      ticks.forEach((tick, index) => {
        expect(toY(tick)).toBeCloseTo(index);
      });
    }
  });

  it('shows at most seven lines, in order, 0 and the ceiling included', () => {
    const { ticks } = compressedAxis(2000, 5);

    expect(ticks.length).toBeLessThanOrEqual(7);
    expect(ticks[0]).toBe(0);
    expect(ticks.at(-1)).toBe(2000);
    expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
  });

  it('keeps a typical spend visibly tall, and bigger amounts taller', () => {
    const { toY } = compressedAxis(2000, 15);

    expect(toY(15) / toY(2000)).toBeGreaterThan(0.1);
    expect(toY(0)).toBe(0);
    expect(toY(800)).toBeLessThan(toY(1100));
    expect(toY(1100)).toBeLessThan(toY(2000));
  });

  it('leaves no thin top band such as $2,000 to $2,500', () => {
    expect(compressedAxis(2500, 15).ticks.slice(-2)).toEqual([1000, 2500]);
  });

  it('has a single zero line for an empty chart', () => {
    expect(compressedAxis(0, 0).ticks).toEqual([0]);
  });
});
