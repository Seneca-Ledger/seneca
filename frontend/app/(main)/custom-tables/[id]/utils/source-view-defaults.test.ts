import { describe, expect, it } from 'vitest';
import { sourceViewDefaults } from './source-view-defaults';
import type { CustomTableColumn, CustomTableGridRow } from './types';

const column = (key: string, field: string): CustomTableColumn =>
  ({ key, title: key, type: 'text', position: 0, config: { source: { field } } }) as unknown as CustomTableColumn;

const columns = [
  column('c_date', 'date'),
  column('c_amount', 'amount'),
  column('c_type', 'type'),
  column('c_currency', 'currency'),
  column('c_statement', 'statement'),
];
const row = (currency: string): CustomTableGridRow =>
  (({
    id: currency,
    rowNumber: 1,
    data: { c_currency: currency }
  }) as CustomTableGridRow);

describe('sourceViewDefaults', () => {
  it('opens newest first without the columns that repeat the row', () => {
    const defaults = sourceViewDefaults(columns, [row('EUR'), row('EUR')]);
    expect(defaults.sorting).toEqual([{ id: 'c_date', desc: true }]);
    expect(defaults.hidden.sort()).toEqual(['c_currency', 'c_statement', 'c_type']);
  });

  it('keeps the currency once the rows hold more than one', () => {
    const defaults = sourceViewDefaults(columns, [row('EUR'), row('USD')]);
    expect(defaults.hidden).not.toContain('c_currency');
  });

  it('hides the currency before any row is in only when asked to assume one', () => {
    expect(sourceViewDefaults(columns, []).hidden).not.toContain('c_currency');
    expect(sourceViewDefaults(columns, [], { assumeSingle: true }).hidden).toContain('c_currency');
  });

  it('leaves a hand-made table as it is', () => {
    const plain = [{ ...columns[0], config: {} }] as CustomTableColumn[];
    expect(sourceViewDefaults(plain, [])).toEqual({ sorting: [], hidden: [] });
  });
});
