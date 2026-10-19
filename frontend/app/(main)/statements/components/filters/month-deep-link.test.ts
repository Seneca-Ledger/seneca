import { describe, expect, it } from 'vitest';
import { monthDeepLinkFilters } from './month-deep-link';

const now = new Date(2026, 8, 30); // 30 September 2026

describe('monthDeepLinkFilters', () => {
  it('reads the running month as the preset the filter chip names', () => {
    expect(monthDeepLinkFilters('2026-09', now)?.date).toEqual({ preset: 'thisMonth' });
  });

  it('reads the month before it as its own preset', () => {
    expect(monthDeepLinkFilters('2026-08', now)?.date).toEqual({ preset: 'lastMonth' });
  });

  it('falls back to an explicit range for older months', () => {
    // A link opened after the month rolled over, or a hand-written insight.
    expect(monthDeepLinkFilters('2026-02', now)?.date).toEqual({
      mode: 'on',
      date: '2026-02-01',
      dateTo: '2026-02-28',
    });
    expect(monthDeepLinkFilters('2025-12', now)?.date).toEqual({
      mode: 'on',
      date: '2025-12-01',
      dateTo: '2025-12-31',
    });
  });

  it('returns nothing for what is not a month, so the page is not emptied', () => {
    expect(monthDeepLinkFilters(null, now)).toBeNull();
    expect(monthDeepLinkFilters(undefined, now)).toBeNull();
    expect(monthDeepLinkFilters('', now)).toBeNull();
    expect(monthDeepLinkFilters('none', now)).toBeNull();
    expect(monthDeepLinkFilters('2026-13', now)).toBeNull();
    expect(monthDeepLinkFilters('2026-9', now)).toBeNull();
  });

  it('touches no filter but the date', () => {
    const filters = monthDeepLinkFilters('2026-09', now);
    expect(filters).toMatchObject({ keywords: '', statuses: [], type: null, limit: null });
  });
});
