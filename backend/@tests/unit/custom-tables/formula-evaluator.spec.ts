import {
  FormulaError,
  assertValidFormula,
  collectFieldRefs,
  evaluateFormula,
  evaluateFormulaDetailed,
  inferFormulaResultType,
  tokenizeFormula,
} from '../../../src/modules/custom-tables/helpers/formula-evaluator';

describe('evaluateFormula', () => {
  const row = { amount: '1000', rate: '0.2', qty: 3, paid: true, note: 'текст' };

  it('respects operator precedence', () => {
    expect(evaluateFormula('[amount] + [qty] * 2', row)).toBe(1006);
  });

  it('respects parentheses', () => {
    expect(evaluateFormula('([amount] + [qty]) * 2', row)).toBe(2006);
  });

  it('computes a VAT-style expression', () => {
    expect(evaluateFormula('[amount] * [rate]', row)).toBeCloseTo(200);
  });

  it('treats an empty cell as zero rather than failing the whole column', () => {
    expect(evaluateFormula('[amount] + [missing]', row)).toBe(1000);
  });

  it('accepts a comma decimal separator', () => {
    expect(evaluateFormula('[x] * 2', { x: '1,5' })).toBe(3);
  });

  it('returns null on division by zero instead of Infinity', () => {
    expect(evaluateFormula('[amount] / [zero]', { amount: '10', zero: '0' })).toBeNull();
  });

  it('returns null when a referenced cell is not a number', () => {
    expect(evaluateFormula('[note] + 1', row)).toBeNull();
  });

  it('returns null for a malformed expression instead of throwing', () => {
    expect(evaluateFormula('[amount] +', row)).toBeNull();
    expect(evaluateFormula('([amount]', row)).toBeNull();
  });

  it('does not execute code embedded in the expression', () => {
    // Ключевое свойство: выражение разбирается, а не исполняется.
    expect(evaluateFormula('process.exit(1)', row)).toBeNull();
    expect(evaluateFormula('[amount].constructor', row)).toBeNull();
  });
});

describe('tokenizeFormula', () => {
  it('rejects characters outside the supported grammar', () => {
    expect(() => tokenizeFormula('[a] % 2')).toThrow(FormulaError);
  });

  it('rejects an over-long expression', () => {
    expect(() => tokenizeFormula('1+'.repeat(400))).toThrow(/too long/);
  });
});

describe('assertValidFormula', () => {
  it('accepts a formula over known columns', () => {
    expect(() => assertValidFormula('[a] + [b]', ['a', 'b'])).not.toThrow();
  });

  it('rejects a reference to a missing column', () => {
    expect(() => assertValidFormula('[a] + [ghost]', ['a'])).toThrow(/Column not found/);
  });

  it('rejects unbalanced parentheses', () => {
    expect(() => assertValidFormula('([a] + 1', ['a'])).toThrow(/parenthesis/);
  });

  it('rejects an empty formula', () => {
    expect(() => assertValidFormula('   ', [])).toThrow(/is empty/);
  });
});

describe('evaluateFormula v2 grammar', () => {
  const row = {
    amount: 1250.5,
    qty: 3,
    rate: '0.2',
    category: 'Еда',
    paid: true,
    date: '2026-09-15',
    empty: '',
  };

  it('supports unary minus, power and percent literals', () => {
    expect(evaluateFormula('-[qty] + 2 ^ 3 ^ 2', row)).toBe(509);
    expect(evaluateFormula('[amount] * 20%', row)).toBeCloseTo(250.1);
    expect(evaluateFormula('([amount])%', row)).toBeCloseTo(12.505);
  });

  it('rounds and takes absolute values', () => {
    expect(evaluateFormula('ROUND([amount], 0)', row)).toBe(1251);
    expect(evaluateFormula('ROUNDDOWN([amount] / 1000, 1)', row)).toBe(1.2);
    expect(evaluateFormula('ROUNDUP(-1.21, 1)', row)).toBe(-1.3);
    expect(evaluateFormula('ABS(-[qty])', row)).toBe(3);
  });

  it('aggregates its arguments and ignores blanks', () => {
    expect(evaluateFormula('SUM([amount], [qty], [empty])', row)).toBe(1253.5);
    expect(evaluateFormula('AVERAGE([qty], [empty], 5)', row)).toBe(4);
    expect(evaluateFormula('MIN([amount], [qty])', row)).toBe(3);
    expect(evaluateFormula('COUNT([amount], [category], [empty])', row)).toBe(1);
    expect(evaluateFormula('COUNTA([amount], [category], [empty])', row)).toBe(2);
  });

  it('compares numbers numerically and text case-insensitively', () => {
    expect(evaluateFormula('[amount] > 1000', row)).toBe(true);
    expect(evaluateFormula('[rate] <= 0.2', row)).toBe(true);
    expect(evaluateFormula('[category] = "еда"', row)).toBe(true);
    expect(evaluateFormula('[category] <> "Еда"', row)).toBe(false);
  });

  it('branches with IF, IFS, AND, OR and NOT', () => {
    expect(evaluateFormula('IF([amount] > 1000, "big", "small")', row)).toBe('big');
    expect(evaluateFormula('IF([paid], [amount], 0)', row)).toBe(1250.5);
    expect(evaluateFormula('IFS([qty] > 5, "many", [qty] > 2, "some", TRUE, "few")', row)).toBe(
      'some',
    );
    expect(evaluateFormula('AND([paid], [qty] > 1)', row)).toBe(true);
    expect(evaluateFormula('OR([qty] > 10, NOT([paid]))', row)).toBe(false);
    expect(evaluateFormula('IF([qty] > 10, "x")', row)).toBeNull();
  });

  it('does not evaluate the branch it does not take', () => {
    expect(evaluateFormula('IF(TRUE, 1, [amount] / 0)', row)).toBe(1);
    expect(evaluateFormula('IFERROR([amount] / 0, "n/a")', row)).toBe('n/a');
  });

  it('works with text', () => {
    expect(evaluateFormula('[category] & " · " & [qty]', row)).toBe('Еда · 3');
    expect(evaluateFormula('CONCAT(UPPER("ab"), LOWER("CD"))', row)).toBe('ABcd');
    expect(evaluateFormula('LEN(TRIM("  a  b "))', row)).toBe(3);
    expect(evaluateFormula('LEFT([category], 1) & RIGHT([category], 2)', row)).toBe('Еда');
    expect(evaluateFormula('"say ""hi"""', row)).toBe('say "hi"');
    expect(evaluateFormula('ISBLANK([empty])', row)).toBe(true);
  });

  it('works with dates', () => {
    expect(evaluateFormula('YEAR([date]) & "-" & MONTH([date])', row)).toBe('2026-9');
    expect(evaluateFormula('DAY([date])', row)).toBe(15);
    expect(evaluateFormula('DAYS("2026-09-30", [date])', row)).toBe(15);
    expect(evaluateFormula('EOMONTH([date], 1)', row)).toBe('2026-10-31');
    expect(evaluateFormula('TODAY()', row)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('accepts a semicolon as an argument separator and lowercase function names', () => {
    expect(evaluateFormula('round([amount]; 1)', row)).toBe(1250.5);
  });

  it('reports the failure reason for the editor preview', () => {
    expect(evaluateFormulaDetailed('[amount] / 0', row)).toEqual({
      value: null,
      error: 'Division by zero',
    });
    expect(evaluateFormulaDetailed('[category] + 1', row).error).toMatch(/Non-numeric/);
  });
});

describe('assertValidFormula v2', () => {
  it('rejects unknown functions and wrong arity', () => {
    expect(() => assertValidFormula('FOO([a])', ['a'])).toThrow(/Unknown function/);
    expect(() => assertValidFormula('ROUND([a], 1, 2)', ['a'])).toThrow(/number of arguments/);
    expect(() => assertValidFormula('TODAY(1)', [])).toThrow(/number of arguments/);
  });

  it('rejects a bare identifier that is not TRUE/FALSE', () => {
    expect(() => assertValidFormula('amount + 1', ['amount'])).toThrow(/Unknown name/);
  });

  it('still rejects a stray percent sign', () => {
    expect(() => tokenizeFormula('% 2')).toThrow(FormulaError);
  });
});

describe('static analysis', () => {
  it('collects referenced columns once each', () => {
    expect(collectFieldRefs('[a] + IF([b] > 1, [a], [c])')).toEqual(['a', 'b', 'c']);
  });

  it('infers the result type from the expression shape', () => {
    const types = { amount: 'number' as const, name: 'text' as const, date: 'date' as const };
    expect(inferFormulaResultType('[amount] * 2', types)).toBe('number');
    expect(inferFormulaResultType('[amount] > 2', types)).toBe('boolean');
    expect(inferFormulaResultType('[name] & "!"', types)).toBe('text');
    expect(inferFormulaResultType('IF([amount] > 2, [name], "")', types)).toBe('text');
    expect(inferFormulaResultType('IFERROR([amount] / 0, 0)', types)).toBe('number');
    expect(inferFormulaResultType('EOMONTH([date], 0)', types)).toBe('date');
    expect(inferFormulaResultType('YEAR([date])', types)).toBe('number');
    expect(inferFormulaResultType('[date]', types)).toBe('date');
  });
});
