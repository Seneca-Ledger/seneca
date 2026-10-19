import { describe, expect, it } from 'vitest';
import { classifyRows, findHeaderRow, isHeaderRow } from './importRows';

describe('findHeaderRow', () => {
  it('skips report title rows and finds the real header', () => {
    const rows = [
      ['Отчёт за сентябрь', '', ''],
      ['', '', ''],
      ['Дата', 'Контрагент', 'Сумма'],
      ['2026-09-01', 'Acme', '1 500,00'],
      ['2026-09-02', 'Globex', '250'],
    ];
    expect(findHeaderRow(rows)).toBe(2);
  });

  it('treats a text row above numeric rows as a header even without known names', () => {
    expect(findHeaderRow([['a', 'b'], ['1', '2']])).toBe(0);
  });

  it('returns -1 when the data starts right away', () => {
    expect(findHeaderRow([['2026-09-01', 'Acme', '15'], ['2026-09-02', 'Globex', '20']])).toBe(-1);
  });

  it('does not mistake a pure text table for a header', () => {
    expect(findHeaderRow([['Alice', 'Berlin'], ['Bob', 'Paris']])).toBe(-1);
    expect(isHeaderRow([['Alice', 'Berlin'], ['Bob', 'Paris']], 0)).toBe(false);
  });
});

describe('classifyRows', () => {
  it('excludes a totals row by its label and remembers column sums', () => {
    const rows = [
      ['2026-09-01', 'Acme', '100'],
      ['2026-09-02', 'Globex', '250'],
      ['Итого', '', '350'],
    ];
    const result = classifyRows(rows);
    expect(result.kinds).toEqual(['data', 'data', 'total']);
    expect(result.totals).toEqual({ rowIndexes: [2], aggregates: { 2: 'sum' } });
  });

  it('recognises a totals row by its aggregate formulas and keeps the function', () => {
    const rows = [
      ['Acme', '100', '10%'],
      ['Globex', '250', '20%'],
      ['', '350', '15%'],
    ];
    const formulas = [
      [undefined, undefined, undefined],
      [undefined, undefined, undefined],
      [undefined, 'SUM(B2:B3)', 'AVERAGE(C2:C3)'],
    ];
    const result = classifyRows(rows, formulas);
    expect(result.kinds[2]).toBe('total');
    expect(result.totals.aggregates).toEqual({ 1: 'sum', 2: 'avg' });
  });

  it('marks text-only rows after the totals as notes', () => {
    const rows = [
      ['2026-09-01', 'Acme', '100'],
      ['Total', '', '100'],
      ['Prepared by accounting', '', ''],
    ];
    expect(classifyRows(rows).kinds).toEqual(['data', 'total', 'note']);
  });

  it('keeps a data row that merely mentions a balance', () => {
    const rows = [['2026-09-01', 'Balance top-up', '100']];
    expect(classifyRows(rows).kinds).toEqual(['data']);
  });
});
