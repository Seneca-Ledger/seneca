import { describe, expect, it } from 'vitest';
import { parseNumberCell, parseNumberCellDetailed, parsePaidCell } from './pasteParser';

describe('parseNumberCellDetailed', () => {
  it.each([
    ['1 500,50', 1500.5],
    ['1 500', 1500],
    ['1,234.56', 1234.56],
    ['1.234,56', 1234.56],
    ['(100)', -100],
    ['100-', -100],
    ['−250', -250],
    ['+42', 42],
  ])('parses %s', (raw, expected) => {
    expect(parseNumberCellDetailed(raw)).toMatchObject({ value: expected, error: false });
  });

  it('strips currency symbols and codes and reports them', () => {
    expect(parseNumberCellDetailed('$1,234.50')).toMatchObject({ value: 1234.5, currency: 'USD' });
    expect(parseNumberCellDetailed('-$100')).toMatchObject({ value: -100, currency: 'USD' });
    expect(parseNumberCellDetailed('1 500 KZT')).toMatchObject({ value: 1500, currency: 'KZT' });
    expect(parseNumberCellDetailed('200 руб.')).toMatchObject({ value: 200, currency: 'RUB' });
  });

  it('reads percents as plain numbers with a flag', () => {
    expect(parseNumberCellDetailed('12,5%')).toMatchObject({ value: 12.5, percent: true, decimals: 1 });
  });

  it('rejects text and unknown suffixes', () => {
    expect(parseNumberCellDetailed('12 шт').error).toBe(true);
    expect(parseNumberCellDetailed('abc').error).toBe(true);
    expect(parseNumberCell('n/a').error).toBe(true);
  });

  it('treats an empty cell as no value, not an error', () => {
    expect(parseNumberCellDetailed('  ')).toMatchObject({ value: null, error: false });
  });
});

describe('parsePaidCell', () => {
  it('accepts check marks and crosses', () => {
    expect(parsePaidCell('✓')).toEqual({ value: true, error: false });
    expect(parsePaidCell('✗')).toEqual({ value: false, error: false });
  });
});
