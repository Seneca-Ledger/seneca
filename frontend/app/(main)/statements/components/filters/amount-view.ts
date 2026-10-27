/**
 * Which figure a statement's row shows in the Amount column. A receipt has one
 * amount and shows it whatever is chosen; a bank statement has its spending and
 * its income over the period.
 */
export type StatementAmountView = 'spending' | 'income' | 'both' | 'net';

export const STATEMENT_AMOUNT_VIEWS: StatementAmountView[] = ['spending', 'income', 'both', 'net'];

type StatementTotals = {
  source?: string | null;
  totalDebit?: number | string | null;
  totalCredit?: number | string | null;
};

const toAmount = (value?: number | string | null): number => {
  const parsed = typeof value === 'string' ? Number(value) : (value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

/**
 * The figure the row is sorted, grouped and range-filtered by: the one it
 * shows, and for Both its spending, the first of the two. Spending falls back
 * to income for a statement that only received money, as it always has.
 */
export function statementAmountFor(
  statement: StatementTotals,
  view: StatementAmountView | null = null,
): number {
  const debit = toAmount(statement.totalDebit);
  const credit = toAmount(statement.totalCredit);
  if (statement.source !== 'scan' && view === 'income') {
    return credit;
  }
  if (statement.source !== 'scan' && view === 'net') {
    return credit - debit;
  }
  return debit > 0 ? debit : credit;
}

const formatFigure = (value: number): string =>
  new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    value,
  );

/**
 * The figure as the row prints it, without the currency. Both puts spending
 * and income on two lines ("−3,535.00" over "+7,405.41"); a net loss starts
 * with "-", which the row shows in red. Nothing moved yet reads "0".
 */
export function formatStatementFigure(
  statement: StatementTotals,
  view: StatementAmountView | null = null,
): string {
  const debit = toAmount(statement.totalDebit);
  const credit = toAmount(statement.totalCredit);
  if (debit === 0 && credit === 0) {
    return '0';
  }
  if (view === 'both') {
    return `−${formatFigure(debit)}\n+${formatFigure(credit)}`;
  }
  const amount = statementAmountFor(statement, view);
  if (view === 'net') {
    return amount < 0 ? `-${formatFigure(-amount)}` : `+${formatFigure(amount)}`;
  }
  return amount === 0 ? '0' : formatFigure(amount);
}

/** "23.00USD" → the figure and the currency code, which the row prints apart. */
export function splitAmountLabel(label: string): { figure: string; currency: string | null } {
  const parts = /^([\s\S]*\d)\s*(\D+)$/.exec(label);
  return parts ? { figure: parts[1], currency: parts[2] } : { figure: label, currency: null };
}
