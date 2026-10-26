import { describe, expect, it } from 'vitest';
import { periodLabel } from './CashFlowView';

describe('periodLabel', () => {
  it('names a whole month by its short name', () => {
    const year = new Date().getFullYear();
    expect(periodLabel(`${year}-08-01`, `${year}-08-31`, 'en-US')).toBe('Aug');
  });

  it('adds the year for a month in another year', () => {
    expect(periodLabel('2020-02-01', '2020-02-29', 'en-US')).toBe('Feb 2020');
  });

  it('gives a range for anything that is not a calendar month', () => {
    const year = new Date().getFullYear();
    expect(periodLabel(`${year}-07-02`, `${year}-08-01`, 'en-US')).toBe('Jul 2 – Aug 1');
  });

  it('puts the year once when the range sits in another year', () => {
    expect(periodLabel('2020-03-10', '2020-03-19', 'en-US')).toBe('Mar 10 – Mar 19, 2020');
  });
});
