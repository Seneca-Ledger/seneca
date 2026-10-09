import { describe, expect, it } from 'vitest';
import { buildPastePreview } from './pasteUtils';

const defaults = {
  date: 'Date',
  type: 'Type',
  amount: 'Amount',
  currency: 'Currency',
  comment: 'Comment',
  paid: 'Paid',
  columnPrefix: 'Column',
};

// Sheet rows: 0 header, 1..3 data, 4 totals. Columns A..D.
const rawRows = [
  ['Дата', 'Сумма', 'Доля', 'Остаток'],
  ['2026-09-01', '100', '0.25', '100'],
  ['2026-09-02', '250', '0.625', '350'],
  ['2026-09-03', '50', '0.125', '400'],
  ['Итого', '400', '', ''],
];
const formulas = [
  [undefined, undefined, undefined, undefined],
  [undefined, undefined, 'B2/B$5', 'B2'],
  [undefined, undefined, 'B3/B$5', 'D2+B3'],
  [undefined, undefined, 'B4/B$5', 'D3+B4'],
  [undefined, 'SUM(B2:B4)', undefined, 'B5-AVERAGE(B2:B4)'],
];
const layout = { originCol: 0, sheetRows: [0, 1, 2, 3, 4] };

describe('buildPastePreview with Excel formulas', () => {
  it('turns dragged-down formulas into formula columns and keeps their values out of the rows', () => {
    const { preview } = buildPastePreview({
      rawRows,
      formulas,
      layout,
      useHeaders: true,
      orderedColumns: [],
      mappingSelection: null,
      edits: {},
      defaults,
    });
    const share = preview.columns.find(column => column.label === 'Доля');
    expect(share).toMatchObject({
      newType: 'formula',
      newConfig: { expression: '[Сумма] / SUM([Сумма])' },
      formula: { excel: 'B2/B$5', overriddenCells: 0 },
    });
    // A running balance whose first row is a plain reference still carries over.
    const balance = preview.columns.find(column => column.label === 'Остаток');
    expect(balance).toMatchObject({
      newType: 'formula',
      newConfig: { expression: 'PREV([Остаток]) + [Сумма]' },
    });
    expect(preview.formulas).toEqual({ carried: 3, total: 3 });
    // The totals row is excluded and its non-aggregate formula becomes a summary.
    expect(preview.totalRows).toBe(3);
    expect(preview.totals.aggregates).toEqual({ __new__1: 'sum' });
    expect(preview.summaries).toEqual([
      { title: 'Остаток', expression: 'SUM([Сумма]) - AVERAGE([Сумма])' },
    ]);
    // Formula columns carry no data: the server computes them.
    expect(preview.dataRows[0]).not.toHaveProperty('__new__2');
    expect(preview.dataRows[0].__new__1).toBe(100);
  });
});
