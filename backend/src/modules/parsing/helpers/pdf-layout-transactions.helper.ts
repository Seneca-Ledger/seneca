import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import type { LayoutTransaction } from './pdf-layout-table.helper';
import {
  type DateParts,
  type NumericDateOrder,
  parseDateParts,
  resolveDate,
} from './statement-date.helper';

/**
 * Rows read from a statement's table, turned into what the parser returns:
 * transactions in the common shape, grouped by account, and the balance the
 * first row's running balance implies.
 */

/** The day/month order placeholder in `date` is only right for unambiguous dates. */
export function reparseDate(transaction: LayoutTransaction, order: NumericDateOrder): DateParts {
  return parseDateParts(transaction.dateText, order) ?? transaction.date;
}

/** Balance before the first row, undone from the first running balance. */
export function openingBalanceFromRows(transactions: LayoutTransaction[]): number | null {
  const first = transactions[0];
  if (first?.balance === undefined) {
    return null;
  }
  const net = (first.credit ?? 0) - (first.debit ?? 0) + (first.amount ?? 0);
  return Number((first.balance - net).toFixed(2));
}

/**
 * Transactions in the shape every parser returns. Without a counterparty
 * column the description is the best name there is, so it fills both. On a
 * card statement a positive amount is a charge.
 */
export function toParsedTransactions(
  transactions: LayoutTransaction[],
  order: NumericDateOrder,
  anchor: Date | null,
  currency: string,
  isCard = false,
): ParsedTransaction[] {
  return transactions.map(transaction => {
    const amount =
      transaction.amount !== undefined && isCard ? -transaction.amount : transaction.amount;
    return {
      transactionDate: resolveDate(reparseDate(transaction, order), anchor),
      counterpartyName: transaction.counterparty || transaction.description,
      counterpartyAccount: transaction.counterpartyAccount,
      paymentPurpose: transaction.description,
      debit: transaction.debit ?? (amount !== undefined && amount < 0 ? -amount : undefined),
      credit: transaction.credit ?? (amount !== undefined && amount >= 0 ? amount : undefined),
      currency,
    };
  });
}

/**
 * Rows grouped by the account heading printed above their table, in the
 * order the accounts appear. A statement with one account (or none named)
 * comes back as a single group.
 */
export function splitByAccount(transactions: LayoutTransaction[]): LayoutTransaction[][] {
  const groups = new Map<string, LayoutTransaction[]>();
  for (const transaction of transactions) {
    const key = transaction.account?.accountNumber ?? '';
    groups.set(key, [...(groups.get(key) ?? []), transaction]);
  }
  return [...groups.values()];
}
