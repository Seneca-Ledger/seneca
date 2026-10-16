import { describe, expect, it } from 'vitest';
import { formatPreviewCell } from './SourceFilterPanel';

const row = { currency: 'EUR' };

describe('formatPreviewCell', () => {
  it('shows money with its currency, two decimals and a typographic minus', () => {
    expect(formatPreviewCell(-67.4, { field: 'amount', type: 'currency' }, row, 'en-US', {})).toBe(
      '−€67.40',
    );
  });

  it('shows dates as "Sep 1, 2024", not ISO', () => {
    expect(
      formatPreviewCell('2024-09-01', { field: 'date', type: 'date' }, row, 'en-US', {}),
    ).toBe('Sep 1, 2024');
  });

  it('translates enum values and leaves other text as stored', () => {
    expect(
      formatPreviewCell('to_pay', { field: 'status', type: 'text' }, row, 'en-US', {
        to_pay: 'To pay',
      }),
    ).toBe('To pay');
    expect(
      formatPreviewCell('to_pay', { field: 'vendor', type: 'text' }, row, 'en-US', {
        to_pay: 'To pay',
      }),
    ).toBe('to_pay');
  });
});
