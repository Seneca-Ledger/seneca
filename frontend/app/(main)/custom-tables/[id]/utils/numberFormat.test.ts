import { describe, expect, it } from 'vitest';
import { formatCellNumber, parseLocalizedNumber } from './numberFormat';

// Intl ставит неразрывные пробелы (U+00A0 / U+202F) — для сравнения приводим к обычным.
const plain = (text: string): string => text.replace(/[\u00a0\u202f]/g, ' ');

describe('parseLocalizedNumber', () => {
  it.each([
    ['1 234,56', 1234.56],
    ['1,234.56', 1234.56],
    ['1.234,56', 1234.56],
    ['1,234', 1234],
    ['1,5', 1.5],
    ['-12,5 %', -12.5],
    ['(123)', -123],
    ['€ 1 000', 1000],
    [' 1 500,00 ₸', 1500],
    ['−7', -7],
  ])('parses %s', (raw, expected) => {
    expect(parseLocalizedNumber(raw)).toBe(expected);
  });

  it.each(['', '   ', 'abc', '1-2', '..'])('returns null for %j', raw => {
    expect(parseLocalizedNumber(raw)).toBeNull();
  });
});

describe('formatCellNumber', () => {
  it('formats money by the app locale, not the browser one', () => {
    expect(formatCellNumber(1234.5, { currency: 'USD', locale: 'en' })).toBe('$1,234.50');
    expect(plain(formatCellNumber(1234.5, { currency: 'EUR', locale: 'de' }))).toBe('1.234,50 €');
  });

  it('honours precision for money', () => {
    expect(formatCellNumber(1234.5, { currency: 'USD', precision: 0, locale: 'en' })).toBe(
      '$1,235',
    );
  });

  it('shows percent from a human number', () => {
    expect(formatCellNumber(12.5, { format: 'percent', locale: 'en' })).toBe('12.5%');
    expect(formatCellNumber(100, { format: 'percent', locale: 'en' })).toBe('100%');
    expect(
      plain(formatCellNumber(12.5, { format: 'percent', precision: 1, locale: 'ru' })),
    ).toBe('12,5 %');
  });

  it('groups plain numbers and keeps up to two decimals by default', () => {
    expect(formatCellNumber(1234567.891, { locale: 'en' })).toBe('1,234,567.89');
    expect(formatCellNumber(5, { precision: 2, locale: 'en' })).toBe('5.00');
  });

  it('returns a dash for a non-finite value', () => {
    expect(formatCellNumber(Number.NaN)).toBe('—');
  });
});
