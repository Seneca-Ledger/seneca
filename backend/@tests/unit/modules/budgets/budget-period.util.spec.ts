import { BudgetPeriodType } from '@/entities/budget.entity';
import {
  clampToWindow,
  computeMonthRange,
  computePeriodRange,
  normalizeLimitToMonth,
  overlapsWindow,
  parseDateOnly,
  parseMonthKey,
  toMonthKey,
} from '@/modules/budgets/budget-period.util';

describe('computePeriodRange', () => {
  // A Friday, so the weekly case has to walk backwards to find its Monday.
  const friday = new Date(2026, 4, 8);

  it('starts a weekly period on Monday', () => {
    const { start, end } = computePeriodRange(BudgetPeriodType.WEEKLY, friday);
    expect(start).toEqual(new Date(2026, 4, 4));
    expect(end).toEqual(new Date(2026, 4, 10));
  });

  it('treats Sunday as the last day of the week, not the first', () => {
    const { start } = computePeriodRange(BudgetPeriodType.WEEKLY, new Date(2026, 4, 10));
    expect(start).toEqual(new Date(2026, 4, 4));
  });

  it('spans the calendar month', () => {
    const { start, end } = computePeriodRange(BudgetPeriodType.MONTHLY, friday);
    expect(start).toEqual(new Date(2026, 4, 1));
    expect(end).toEqual(new Date(2026, 4, 31));
  });

  it('spans the calendar quarter', () => {
    const { start, end } = computePeriodRange(BudgetPeriodType.QUARTERLY, friday);
    expect(start).toEqual(new Date(2026, 3, 1));
    expect(end).toEqual(new Date(2026, 5, 30));
  });

  it('spans the calendar year', () => {
    const { start, end } = computePeriodRange(BudgetPeriodType.ANNUAL, friday);
    expect(start).toEqual(new Date(2026, 0, 1));
    expect(end).toEqual(new Date(2026, 11, 31));
  });
});

describe('normalizeLimitToMonth', () => {
  it('leaves a monthly limit alone', () => {
    expect(normalizeLimitToMonth(1200, BudgetPeriodType.MONTHLY)).toBe(1200);
  });

  it('scales a weekly limit by 52/12 rather than by 4', () => {
    // 4 weeks a month would lose ~8% of the year.
    expect(normalizeLimitToMonth(120, BudgetPeriodType.WEEKLY)).toBeCloseTo(520, 6);
  });

  it('divides quarterly and annual limits down to a month', () => {
    expect(normalizeLimitToMonth(3000, BudgetPeriodType.QUARTERLY)).toBe(1000);
    expect(normalizeLimitToMonth(12000, BudgetPeriodType.ANNUAL)).toBe(1000);
  });
});

describe('month keys', () => {
  it('resolves a YYYY-MM key to a date inside that month', () => {
    expect(parseMonthKey('2026-02', new Date(2026, 8, 1))).toEqual(new Date(2026, 1, 1));
  });

  it('falls back when no key is given', () => {
    const fallback = new Date(2026, 8, 8);
    expect(parseMonthKey(undefined, fallback)).toBe(fallback);
  });

  it('pads single-digit months on the way out', () => {
    expect(toMonthKey(new Date(2026, 0, 31))).toBe('2026-01');
  });

  it('round-trips a key through the month range', () => {
    const { start, end } = computeMonthRange(parseMonthKey('2026-02', new Date()));
    expect(start).toEqual(new Date(2026, 1, 1));
    // 2026 is not a leap year: February must end on the 28th.
    expect(end).toEqual(new Date(2026, 1, 28));
  });
});

describe('budget windows', () => {
  const may = { start: new Date(2026, 4, 1), end: new Date(2026, 4, 31) };

  it('leaves an open-ended budget untouched', () => {
    expect(clampToWindow(may, { startsOn: null, endsOn: null })).toEqual(may);
  });

  it('does not charge a budget for the days before it started', () => {
    const clamped = clampToWindow(may, { startsOn: '2026-05-10', endsOn: null });
    expect(clamped).toEqual({ start: new Date(2026, 4, 10), end: new Date(2026, 4, 31) });
  });

  it('stops at the end of the window', () => {
    const clamped = clampToWindow(may, { startsOn: null, endsOn: '2026-05-20' });
    expect(clamped).toEqual({ start: new Date(2026, 4, 1), end: new Date(2026, 4, 20) });
  });

  it('reports no overlap once the window has closed', () => {
    const window = { startsOn: '2026-02-01', endsOn: '2026-04-30' };
    expect(clampToWindow(may, window)).toBeNull();
    expect(overlapsWindow(may, window)).toBe(false);
  });

  it('reports no overlap before the window opens', () => {
    expect(overlapsWindow(may, { startsOn: '2026-06-01', endsOn: null })).toBe(false);
  });

  it('counts a single overlapping day as an overlap', () => {
    expect(overlapsWindow(may, { startsOn: '2026-05-31', endsOn: null })).toBe(true);
  });

  // A UTC parse of '2026-05-01' lands on April 30 west of Greenwich, which
  // would put the clamp a day off against the locally built period ranges.
  it('parses a date column as local midnight', () => {
    expect(parseDateOnly('2026-05-01')).toEqual(new Date(2026, 4, 1));
  });
});
