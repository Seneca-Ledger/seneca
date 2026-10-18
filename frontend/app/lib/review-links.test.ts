import { describe, expect, it } from 'vitest';
import { REVIEW_LINK_PARAMS, reviewHref } from './review-links';

describe('reviewHref', () => {
  it('opens Review on the month, the list and the filter a dashboard count stands for', () => {
    const october = new Date(2026, 9, 31);

    expect(reviewHref(october)).toBe('/review?month=2026-10');
    expect(reviewHref(october, { kind: 'receipt' })).toBe('/review?kind=receipt&month=2026-10');
    expect(reviewHref(october, { uncategorized: true })).toBe(
      '/review?uncategorized=true&month=2026-10',
    );
  });

  it('writes the parameters Review reads', () => {
    const url = new URL(reviewHref(new Date(2026, 0, 1), { uncategorized: true }), 'http://x');

    expect(url.searchParams.get(REVIEW_LINK_PARAMS.month)).toBe('2026-01');
    expect(url.searchParams.get(REVIEW_LINK_PARAMS.uncategorized)).toBe('true');
  });
});
