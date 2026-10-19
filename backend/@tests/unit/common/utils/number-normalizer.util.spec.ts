import {
  normalizeNumber,
  normalizeNumberAdvanced,
  normalizeDate,
} from '@/common/utils/number-normalizer.util';

describe('normalizeNumber', () => {
  it('returns null for null/undefined', () => {
    expect(normalizeNumber(null)).toBeNull();
    expect(normalizeNumber(undefined)).toBeNull();
  });

  it('returns number input unchanged', () => {
    expect(normalizeNumber(42.5)).toBe(42.5);
    expect(normalizeNumber(0)).toBe(0);
    expect(normalizeNumber(-10)).toBe(-10);
  });

  it('returns null for non-string non-number input', () => {
    expect(normalizeNumber({} as any)).toBeNull();
  });

  it('parses simple number string', () => {
    expect(normalizeNumber('123.45')).toBe(123.45);
  });

  it('replaces comma with dot (EU decimal)', () => {
    expect(normalizeNumber('123,45')).toBe(123.45);
  });

  it('removes spaces (thousands separator)', () => {
    expect(normalizeNumber('1 234 567')).toBe(1234567);
  });

  it('handles comma-as-thousands + dot-as-decimal (US)', () => {
    // "1,234.56" → commas replaced to dots → "1.234.56" → multiple dots handling
    expect(normalizeNumber('1,234.56')).toBe(1234.56);
  });

  it('handles multiple dots — keeps last as decimal', () => {
    expect(normalizeNumber('1.234.56')).toBe(1234.56);
  });

  it('strips non-numeric chars', () => {
    expect(normalizeNumber('$1,234.56')).toBe(1234.56);
  });

  it('handles negative numbers', () => {
    expect(normalizeNumber('-500.25')).toBe(-500.25);
  });

  it('returns null for completely invalid string', () => {
    expect(normalizeNumber('abc')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(normalizeNumber('')).toBeNull();
  });

  it('treats a lone comma thousands group as grouping, not a decimal', () => {
    expect(normalizeNumber('1,234')).toBe(1234);
  });

  it('treats a lone dot thousands group as grouping, not a decimal', () => {
    expect(normalizeNumber('1.234')).toBe(1234);
  });

  it('still treats a lone comma with 2 digits as a decimal', () => {
    expect(normalizeNumber('12,34')).toBe(12.34);
  });

  it('handles trailing-minus negative notation', () => {
    expect(normalizeNumber('100-')).toBe(-100);
  });

  it('handles parenthesised negative notation', () => {
    expect(normalizeNumber('(100.50)')).toBe(-100.5);
  });

  it('handles unicode minus sign', () => {
    expect(normalizeNumber('−100')).toBe(-100);
  });

  it('handles negative number with thousands grouping', () => {
    expect(normalizeNumber('-1,234.56')).toBe(-1234.56);
  });
});

describe('normalizeNumberAdvanced', () => {
  it('returns null value for null/undefined', () => {
    expect(normalizeNumberAdvanced(null)).toEqual({ value: null, normalized: '' });
    expect(normalizeNumberAdvanced(undefined)).toEqual({ value: null, normalized: '' });
  });

  it('returns number input unchanged', () => {
    expect(normalizeNumberAdvanced(42)).toEqual({ value: 42, normalized: '42' });
  });

  it('parses with German/Russian locale (dot=thousands, comma=decimal)', () => {
    expect(normalizeNumberAdvanced('1.234,56', 'de')).toEqual({
      value: 1234.56,
      normalized: '1234.56',
    });
    expect(normalizeNumberAdvanced('1.234,56', 'ru')).toEqual({
      value: 1234.56,
      normalized: '1234.56',
    });
  });

  it('parses with English locale (comma=thousands)', () => {
    expect(normalizeNumberAdvanced('1,234.56', 'en')).toEqual({
      value: 1234.56,
      normalized: '1234.56',
    });
  });

  it('handles comma-only as decimal in English locale', () => {
    // "1,56" with no dot → comma treated as decimal
    expect(normalizeNumberAdvanced('1,56', 'en')).toEqual({
      value: 1.56,
      normalized: '1.56',
    });
  });

  it('returns null for invalid input', () => {
    expect(normalizeNumberAdvanced({} as any)).toEqual({ value: null, normalized: '' });
  });
});

describe('normalizeDate', () => {
  it('returns null for empty/falsy input', () => {
    expect(normalizeDate('')).toBeNull();
    expect(normalizeDate(null as any)).toBeNull();
  });

  it('parses DD.MM.YYYY format', () => {
    const result = normalizeDate('25.04.2026');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(3); // April
    expect(result!.getDate()).toBe(25);
  });

  it('parses DD.MM.YYYY HH:MM:SS format', () => {
    const result = normalizeDate('25.04.2026 14:30:00');
    expect(result).not.toBeNull();
    expect(result!.getHours()).toBe(14);
    expect(result!.getMinutes()).toBe(30);
  });

  it('parses a one-digit hour and a time without seconds', () => {
    // Kaspi prints "08.12.2025 0:20:11", Bereke "27.11.2025 09:22".
    expect(normalizeDate('08.12.2025 0:20:11')).toEqual(new Date(2025, 11, 8, 0, 20, 11));
    expect(normalizeDate('27.11.2025 09:22')).toEqual(new Date(2025, 10, 27, 9, 22, 0));
  });

  it('does not read a bare number as a date', () => {
    // V8 parses "2" as 2001-02-01 — a column-numbering cell became a row.
    expect(normalizeDate('2')).toBeNull();
    expect(normalizeDate('2026')).toBeNull();
  });

  it('parses YYYY-MM-DD format', () => {
    const result = normalizeDate('2026-04-25');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2026);
  });

  it('parses DD/MM/YYYY format', () => {
    const result = normalizeDate('25/04/2026');
    expect(result).not.toBeNull();
    expect(result!.getMonth()).toBe(3); // April
  });

  it('parses DD/MM/YY with 2-digit year (<=49 → 2000s)', () => {
    const result = normalizeDate('25/04/26');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2026);
  });

  it('parses DD/MM/YY with 2-digit year (>49 → 1900s)', () => {
    const result = normalizeDate('25/04/95');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(1995);
  });

  it('returns null for garbage input', () => {
    expect(normalizeDate('not a date')).toBeNull();
  });
});
