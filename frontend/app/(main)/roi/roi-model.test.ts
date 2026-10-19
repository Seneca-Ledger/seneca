import { describe, expect, it } from 'vitest';
import { buildProjection, calculateRoi, parseAmount, splitPayback } from './roi-model';

describe('calculateRoi', () => {
  it('turns monthly income into an annual return on the outlay', () => {
    const result = calculateRoi(120_000, 1_000);

    expect(result).toEqual({
      annualIncome: 12_000,
      annualRoiPercent: 10,
      paybackYears: 10,
    });
  });

  it('refuses to describe a return on nothing', () => {
    expect(calculateRoi(0, 1_000)).toBeNull();
    expect(calculateRoi(-5, 1_000)).toBeNull();
    expect(calculateRoi(Number.NaN, 1_000)).toBeNull();
  });

  it('reports no payback period when the asset pays nothing', () => {
    const result = calculateRoi(120_000, 0);

    expect(result?.annualRoiPercent).toBe(0);
    expect(result?.paybackYears).toBeNull();
  });

  it('handles an asset that costs money to hold', () => {
    const result = calculateRoi(100_000, -500);

    expect(result?.annualRoiPercent).toBe(-6);
    expect(result?.paybackYears).toBeNull();
  });
});

describe('buildProjection', () => {
  it('starts both scenarios at the amount invested', () => {
    const [first] = buildProjection(1_000, 100);

    expect(first).toEqual({ year: 0, compound: 1_000, simple: 1_000 });
  });

  it('grows the reinvested scenario on a widening base', () => {
    const points = buildProjection(1_000, 100, 2);

    // 10% a year: 1000 → 1100 → 1210, against a flat 100 a year.
    expect(points[1].compound).toBeCloseTo(1_100);
    expect(points[2].compound).toBeCloseTo(1_210);
    expect(points[2].simple).toBe(1_200);
  });

  it('keeps the two scenarios level when nothing is earned', () => {
    const points = buildProjection(1_000, 0, 5);

    expect(points.every(point => point.compound === point.simple)).toBe(true);
  });

  it('covers every year up to the horizon, inclusive of both ends', () => {
    const points = buildProjection(1_000, 100, 30);

    expect(points).toHaveLength(31);
    expect(points[30].year).toBe(30);
  });
});

describe('splitPayback', () => {
  it('states a fractional year in years and months', () => {
    expect(splitPayback(2.5)).toEqual({ years: 2, months: 6 });
    expect(splitPayback(0.25)).toEqual({ years: 0, months: 3 });
    expect(splitPayback(10)).toEqual({ years: 10, months: 0 });
  });
});

describe('parseAmount', () => {
  it('reads amounts typed with either decimal mark and thousands grouped', () => {
    expect(parseAmount('10000')).toBe(10000);
    expect(parseAmount('10,000')).toBe(10000);
    expect(parseAmount('10,000.50')).toBe(10000.5);
    expect(parseAmount('10 000,50')).toBe(10000.5);
    expect(parseAmount('10.000,5')).toBe(10000.5);
    expect(parseAmount("10'000")).toBe(10000);
  });

  it('has nothing to say about an empty or unreadable field', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('  ')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
});
