import type { RowRule } from './pdf-layout-row-date.helper';
import type { LayoutTransaction } from './pdf-layout-table.helper';
import { toParsedTransactions } from './pdf-layout-transactions.helper';
import { checkBalanceChain, checkPrintedTotals } from './statement-checks.helper';
import { detectNumericDateOrder } from './statement-date.helper';
import {
  findStatementAnchor,
  findStatementTotals,
  isCreditCardStatement,
} from './statement-metadata.helper';

/** The row rules a statement is read under, the usual one first. */
export const ROW_RULES: RowRule[] = ['dated', 'strict', 'money'];

/**
 * How many of the statement's own checks a reading fails: the running
 * balance printed on its rows and the printed sums of money in and out. A
 * check the statement gives nothing for fails nothing.
 */
export function failedChecks(rows: LayoutTransaction[], text: string): number {
  const order = detectNumericDateOrder(rows.map(row => row.dateText)) ?? 'dmy';
  const isCard = isCreditCardStatement(text);
  const parsed = toParsedTransactions(rows, order, findStatementAnchor(text, order), '', isCard);
  return [
    checkBalanceChain(rows, isCard),
    checkPrintedTotals(findStatementTotals(text, order), parsed),
  ].filter(check => check && !check.passed).length;
}

/**
 * The reading the checks agree with best: fewest failed checks, the usual
 * rule on a tie, and never one of no rows while another reads some. So a
 * layout the usual rule misreads is read right by another without a rule
 * written for it, and one it reads right stays as it was.
 */
export function pickByChecks(readings: LayoutTransaction[][], text: string): LayoutTransaction[] {
  let best = readings[0];
  let bestFailed = failedChecks(best, text);
  for (const reading of readings.slice(1)) {
    if (reading.length === 0) {
      continue;
    }
    const failed = failedChecks(reading, text);
    if (best.length === 0 || failed < bestFailed) {
      best = reading;
      bestFailed = failed;
    }
  }
  return best;
}
