import { describe, expect, it } from 'vitest';
import { formatStatementFigure, splitAmountLabel, statementAmountFor } from './amount-view';

const statement = { source: 'statement', totalDebit: '3535.00', totalCredit: '7405.41' };
const receipt = { source: 'scan', totalDebit: 12.5, totalCredit: 0 };

describe('amount view', () => {
  it('shows spending by default, as before', () => {
    expect(statementAmountFor(statement)).toBe(3535);
    expect(formatStatementFigure(statement)).toBe('3,535.00');
    expect(formatStatementFigure({ totalCredit: 100 })).toBe('100.00');
  });

  it('shows income, both on two lines, or the net change with its sign', () => {
    expect(formatStatementFigure(statement, 'income')).toBe('7,405.41');
    expect(formatStatementFigure(statement, 'both')).toBe('−3,535.00\n+7,405.41');
    expect(formatStatementFigure(statement, 'net')).toBe('+3,870.41');
    expect(formatStatementFigure({ totalDebit: 50, totalCredit: 20 }, 'net')).toBe('-30.00');
  });

  it('sorts and filters by the figure shown, and by spending for both', () => {
    expect(statementAmountFor(statement, 'income')).toBe(7405.41);
    expect(statementAmountFor(statement, 'net')).toBeCloseTo(3870.41);
    expect(statementAmountFor(statement, 'both')).toBe(3535);
  });

  it('leaves a receipt at its one amount and a statement without movement at 0', () => {
    expect(statementAmountFor(receipt, 'income')).toBe(12.5);
    expect(formatStatementFigure({ totalDebit: 0, totalCredit: null }, 'both')).toBe('0');
  });

  it('splits the currency off a label of one or two lines', () => {
    expect(splitAmountLabel('23.00USD')).toEqual({ figure: '23.00', currency: 'USD' });
    expect(splitAmountLabel('−1.00\n+2.00AUD')).toEqual({ figure: '−1.00\n+2.00', currency: 'AUD' });
    expect(splitAmountLabel('-')).toEqual({ figure: '-', currency: null });
  });
});
