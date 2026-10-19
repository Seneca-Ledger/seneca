import { describe, expect, it } from 'vitest';
import { configForType, fieldForType, inferColumnType } from './importTypes';

describe('inferColumnType', () => {
  it('detects dates', () => {
    expect(inferColumnType(['2026-09-01', '02.09.2026', 'n/a'])).toMatchObject({
      type: 'date',
      field: 'date',
    });
  });

  it('detects percent columns and keeps the precision', () => {
    expect(inferColumnType(['12%', '7.5%', '40 %'])).toEqual({
      type: 'number',
      config: { format: 'percent', precision: 1 },
      field: 'amount',
    });
  });

  it('detects money by currency symbols in the cells', () => {
    expect(inferColumnType(['$1,200.50', '$80', '$5'])).toEqual({
      type: 'currency',
      config: { precision: 2, currency: 'USD' },
      field: 'amount',
    });
  });

  it('detects money by the header when the cells are bare numbers', () => {
    expect(inferColumnType(['1500', '250'], { header: 'Сумма' })).toMatchObject({
      type: 'currency',
      config: { precision: 2 },
    });
  });

  it('detects money by the Excel number format', () => {
    const cells = [
      { text: '1 500', kind: 'number' as const, numFmt: '#,##0 [$₸-43F]' },
      { text: '250', kind: 'number' as const, numFmt: '#,##0 [$₸-43F]' },
    ];
    expect(inferColumnType(['1 500', '250'], { cells })).toMatchObject({ type: 'currency' });
  });

  it('prefers numbers over booleans for 0/1 columns', () => {
    expect(inferColumnType(['1', '0', '1', '1'])).toMatchObject({ type: 'number' });
  });

  it('detects boolean columns', () => {
    expect(inferColumnType(['да', 'нет', '✓', 'yes'])).toMatchObject({ type: 'boolean' });
  });

  it('detects a select when a few values repeat across many rows', () => {
    const values = ['Еда', 'Транспорт', 'Еда', 'Жильё', 'Еда', 'Транспорт', 'Еда', 'Жильё', 'Еда', 'Еда', 'Транспорт'];
    const result = inferColumnType(values);
    expect(result.type).toBe('select');
    expect(result.config?.options).toHaveLength(3);
  });

  it('falls back to text for free-form values', () => {
    expect(inferColumnType(['Lunch with a client', 'Taxi to the airport', 'Office chairs'])).toEqual({
      type: 'text',
      field: null,
    });
  });

  it('keeps only the config that fits the type the user picked', () => {
    const config = { currency: 'EUR', precision: 2, format: 'percent' as const, options: ['a'] };
    expect(configForType('currency', config)).toEqual({ precision: 2, currency: 'EUR' });
    expect(configForType('number', config)).toEqual({ precision: 2, format: 'percent' });
    expect(configForType('select', config)).toEqual({ options: ['a'] });
    expect(configForType('text', config)).toBeUndefined();
    expect(fieldForType('currency')).toBe('amount');
    expect(fieldForType('select')).toBeNull();
  });
});
