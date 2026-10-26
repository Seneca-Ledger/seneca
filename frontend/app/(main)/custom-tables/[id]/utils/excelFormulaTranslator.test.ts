import { describe, expect, it } from 'vitest';
import {
  decideColumnFormula,
  normalizeFormulaShape,
  type TranslationScope,
  translateExcelFormula,
  translateTotalsFormula,
} from './excelFormulaTranslator';

// Sheet: row 0 title, row 2 header, rows 3..14 data, row 15 totals. Columns A..F.
const titles = ['Дата', 'Контрагент', 'Категория', 'Сумма', 'Доля', 'Остаток'];
const scopeAt = (cellRow: number): TranslationScope => ({
  cellRow,
  dataRows: { first: 3, last: 14 },
  columnAt: col => (titles[col] ? { title: titles[col] } : null),
  totalsAggregateAt: (row, col) => (row === 15 && col === 3 ? 'sum' : row === 15 && col === 4 ? 'avg' : null),
});

describe('translateExcelFormula', () => {
  it('maps same-row references to column titles', () => {
    expect(translateExcelFormula('=D5*2+ROUND(D5/3, 1)', scopeAt(4))).toEqual({
      kind: 'row',
      expression: '[Сумма] * 2 + ROUND([Сумма] / 3, 1)',
    });
  });

  it('maps a reference to the row above to PREV', () => {
    expect(translateExcelFormula('=F4+D5', scopeAt(4))).toEqual({
      kind: 'row',
      expression: 'PREV([Остаток]) + [Сумма]',
    });
  });

  it('maps column ranges and totals cells to column aggregates', () => {
    expect(translateExcelFormula('=D5/SUM(D$4:D$15)', scopeAt(4))).toEqual({
      kind: 'row',
      expression: '[Сумма] / SUM([Сумма])',
    });
    expect(translateExcelFormula('=D5/$D$16', scopeAt(4))).toEqual({
      kind: 'row',
      expression: '[Сумма] / SUM([Сумма])',
    });
    expect(translateExcelFormula('=D5/D:D', scopeAt(4)).kind).toBe('unsupported');
    expect(translateExcelFormula('=D5/SUM(D:D)', scopeAt(4))).toEqual({
      kind: 'row',
      expression: '[Сумма] / SUM([Сумма])',
    });
  });

  it('reorders SUMIF and COUNTIF arguments', () => {
    expect(translateExcelFormula('=SUMIF($C$4:$C$15, C5, $D$4:$D$15)', scopeAt(4))).toEqual({
      kind: 'row',
      expression: 'SUMIF([Сумма], [Категория], [Категория])',
    });
    expect(translateExcelFormula('=COUNTIF(C$4:C$15; "Еда")', scopeAt(4))).toEqual({
      kind: 'row',
      expression: 'COUNTIF([Категория], "Еда")',
    });
  });

  it('keeps IF, comparisons, percent, text and booleans', () => {
    expect(translateExcelFormula('=IF(D5>1000,"big","small")&" deal"', scopeAt(4))).toEqual({
      kind: 'row',
      expression: 'IF([Сумма] > 1000, "big", "small") & " deal"',
    });
    expect(translateExcelFormula('=D5*10%', scopeAt(4)).kind).toBe('row');
    expect(translateExcelFormula('=CONCATENATE(B5, TRUE)', scopeAt(4))).toEqual({
      kind: 'row',
      expression: 'CONCAT([Контрагент], TRUE)',
    });
  });

  it('refuses what the table cannot express, with a reason', () => {
    expect(translateExcelFormula('=VLOOKUP(C5, H:I, 2, 0)', scopeAt(4))).toMatchObject({
      kind: 'unsupported',
      reason: expect.stringMatching(/VLOOKUP/),
    });
    expect(translateExcelFormula("=Sheet2!A1", scopeAt(4))).toMatchObject({
      kind: 'unsupported',
      reason: expect.stringMatching(/another sheet/),
    });
    expect(translateExcelFormula('=D3', scopeAt(5))).toMatchObject({
      kind: 'unsupported',
      reason: expect.stringMatching(/another row/),
    });
    expect(translateExcelFormula('=G5', scopeAt(4))).toMatchObject({
      kind: 'unsupported',
      reason: expect.stringMatching(/not imported/),
    });
    expect(translateExcelFormula('=D5+MyRange', scopeAt(4)).kind).toBe('unsupported');
  });
});

describe('translateTotalsFormula', () => {
  it('turns a totals-row formula into a summary over column aggregates', () => {
    expect(translateTotalsFormula('=D16-E16*100', scopeAt(15))).toEqual({
      kind: 'summary',
      expression: 'SUM([Сумма]) - AVERAGE([Доля]) * 100',
    });
    expect(translateTotalsFormula('=D5', scopeAt(15)).kind).toBe('unsupported');
  });
});

describe('decideColumnFormula', () => {
  const cells = (formulas: Array<string | undefined>) =>
    formulas.map(formula => ({ formula, text: '1' }));

  it('accepts a formula dragged down the column even with a hand-typed cell', () => {
    const decision = decideColumnFormula(
      cells(['=D4*2', '=D5*2', undefined, '=D7*2', '=D8*2']),
      index => index + 3,
      index => scopeAt(index + 3),
    );
    expect(decision).toMatchObject({
      excel: '=D4*2',
      translation: { kind: 'row', expression: '[Сумма] * 2' },
      overriddenCells: 1,
    });
  });

  it('accepts a running balance whose first row is a plain reference', () => {
    const decision = decideColumnFormula(
      cells(['=D4', '=F4+D5', '=F5+D6', '=F6+D7']),
      index => index + 3,
      index => scopeAt(index + 3),
    );
    expect(decision?.translation).toEqual({
      kind: 'row',
      expression: 'PREV([Остаток]) + [Сумма]',
    });
  });

  it('refuses when the formulas change shape between rows', () => {
    const decision = decideColumnFormula(
      cells(['=D4*2', '=D5*3', '=D6*2']),
      index => index + 3,
      index => scopeAt(index + 3),
    );
    expect(decision?.translation).toMatchObject({ kind: 'unsupported' });
  });

  it('ignores columns where most cells are plain values', () => {
    expect(
      decideColumnFormula(cells(['=D4*2', undefined, undefined, undefined]), i => i + 3, i => scopeAt(i + 3)),
    ).toBeNull();
  });

  it('normalises relative rows to offsets and keeps absolute rows', () => {
    expect(normalizeFormulaShape('=d5*$D$16+F4', 4)).toBe('D[0]*$D$16+F[-1]');
  });
});
