import { describe, expect, it } from 'vitest';
import { formatMoney, netDirection, periodFor, toDateInput } from './tax-return.helpers';

describe('periodFor', () => {
  it('builds the quarter the date falls in', () => {
    expect(periodFor('thisQuarter', new Date(2026, 4, 15))).toEqual({
      periodStart: '2026-04-01',
      periodEnd: '2026-06-30',
    });
  });

  it('builds the previous quarter', () => {
    expect(periodFor('lastQuarter', new Date(2026, 4, 15))).toEqual({
      periodStart: '2026-01-01',
      periodEnd: '2026-03-31',
    });
  });

  it('crosses the year boundary backwards', () => {
    // Q1 of 2026 back one quarter is Q4 of 2025, not month −3 of 2026.
    expect(periodFor('lastQuarter', new Date(2026, 1, 10))).toEqual({
      periodStart: '2025-10-01',
      periodEnd: '2025-12-31',
    });
  });

  it('ends February on the right day in a leap year', () => {
    expect(periodFor('thisQuarter', new Date(2028, 0, 15)).periodEnd).toBe('2028-03-31');
  });

  it('builds the calendar year', () => {
    expect(periodFor('thisYear', new Date(2026, 6, 1))).toEqual({
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
    });
  });
});

describe('toDateInput', () => {
  it('uses the local calendar day and zero-pads', () => {
    // Late-evening local time is already the next day in UTC east of Greenwich,
    // so an ISO conversion here would ask the API for the wrong period edge.
    expect(toDateInput(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});

describe('netDirection', () => {
  it('separates what is owed from what is reclaimable', () => {
    expect(netDirection(120)).toBe('payable');
    expect(netDirection(-40)).toBe('refund');
    expect(netDirection(0)).toBe('zero');
  });

  it('treats an unusable value as zero rather than owed', () => {
    expect(netDirection('not a number')).toBe('zero');
  });
});

describe('formatMoney', () => {
  it('always shows two decimals with the currency', () => {
    expect(formatMoney('1285.7', 'KZT')).toContain('KZT');
    expect(formatMoney('1285.7', 'KZT')).toMatch(/1[ ,.]?285[.,]70/);
  });

  it('degrades rather than printing NaN', () => {
    expect(formatMoney('oops', 'EUR')).toBe('—');
  });
});
