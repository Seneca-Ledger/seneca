import { describe, expect, it } from 'vitest';
import { formatFilingDate, isDeadlinePassed } from './filing-info.helpers';

describe('filing info helpers', () => {
  it('keeps the deadline open until the end of its day', () => {
    expect(isDeadlinePassed('2026-04-30', new Date('2026-04-30T18:00:00'))).toBe(false);
    expect(isDeadlinePassed('2026-04-30', new Date('2026-05-01T00:00:01'))).toBe(true);
  });

  it('formats a date-only value without shifting the day', () => {
    expect(formatFilingDate('2026-04-30', 'en-GB')).toBe('30 Apr 2026');
  });
});
