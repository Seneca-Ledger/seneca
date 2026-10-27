import type { PdfTextItem, PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import {
  type LaidOutRow,
  type LayoutColumn,
  layOutRow,
  readHeaderRow,
} from './pdf-layout-columns.helper';
import { findStatementAmounts } from './statement-amount.helper';
import {
  type DateParts,
  type NumericDateOrder,
  parseDateParts,
  resolveDate,
} from './statement-date.helper';

/**
 * Reads transactions from a statement whose table has no ruling lines, using
 * where each word sits on the page. A row that starts with a date and carries
 * an amount opens a transaction; the lines under it, up to the next one, add
 * to its description. Dates are returned as parts: the year and the day/month
 * order are settled by the caller for the whole statement.
 */

export interface LayoutTransaction {
  date: DateParts;
  /** Printed date, kept for deciding the statement's day/month order. */
  dateText: string;
  description: string;
  counterparty: string;
  counterpartyAccount?: string;
  debit?: number;
  credit?: number;
  /** Signed, from a single amount column. */
  amount?: number;
  /** Running balance after this row, when the table prints one. */
  balance?: number;
}

/** A line further than this many line heights below the previous one is not a continuation. */
const CONTINUATION_LINE_HEIGHTS = 2.6;

const IBAN = /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/;

/** Up to three leading words that make one date ("02 janv. 25"); longest first. */
function leadingDate(
  items: PdfTextItem[],
): { parts: DateParts; text: string; used: number } | null {
  for (let used = Math.min(3, items.length); used > 0; used -= 1) {
    const text = items
      .slice(0, used)
      .map(item => item.text)
      .join(' ');
    // Day-first is a placeholder: the order is decided later from dateText.
    const parts = parseDateParts(text, 'dmy') ?? parseDateParts(text, 'mdy');
    if (parts) {
      return { parts, text, used };
    }
  }
  return null;
}

function appendText(transaction: LayoutTransaction, laidOut: LaidOutRow) {
  const description = laidOut.text.description ?? [];
  const counterparty = (laidOut.text.counterparty ?? []).filter(word => {
    if (IBAN.test(word) && !transaction.counterpartyAccount) {
      transaction.counterpartyAccount = word;
      return false;
    }
    return true;
  });
  transaction.description = [transaction.description, ...description].join(' ').trim();
  transaction.counterparty = [transaction.counterparty, ...counterparty].join(' ').trim();
}

function openTransaction(
  date: { parts: DateParts; text: string },
  laidOut: LaidOutRow,
): LayoutTransaction {
  const transaction: LayoutTransaction = {
    date: date.parts,
    dateText: date.text,
    description: '',
    counterparty: '',
  };
  for (const { role, value } of laidOut.amounts) {
    if (role === 'debit') {
      transaction.debit = Math.abs(value);
    } else if (role === 'credit') {
      transaction.credit = Math.abs(value);
    } else if (role === 'amount') {
      transaction.amount = value;
    } else if (role === 'balance') {
      transaction.balance = value;
    }
  }
  appendText(transaction, laidOut);
  return transaction;
}

/**
 * Words that overlap on the page cannot share a printed line: a footer laid
 * over the last row ends up in the same extracted row a fraction of a point
 * higher. Such a row splits by each word's top; any other row stays whole.
 */
function splitOverlappingLines(row: PdfTextRow): PdfTextRow[] {
  const items = [...row.items].sort((a, b) => a.x - b.x);
  const overlaps = items.some((item, index) =>
    items
      .slice(index + 1)
      .some(other => other.x < item.x + item.width && Math.abs(other.y - item.y) > 0.3),
  );
  if (!overlaps) {
    return [row];
  }
  const lines: PdfTextRow[] = [];
  for (const item of [...items].sort((a, b) => a.y - b.y)) {
    const line = lines.find(candidate => Math.abs(candidate.y - item.y) <= 0.3);
    if (line) {
      line.items.push(item);
    } else {
      lines.push({ ...row, y: item.y, items: [item] });
    }
  }
  return lines;
}

function rowHeight(row: PdfTextRow): number {
  return Math.max(...row.items.map(item => item.height), 1);
}

/**
 * Whether a line without its own date adds to the transaction above it: it
 * sits right under the previous line, carries no money (money anywhere makes
 * it a totals line or a note such as "Frais sur compte: 23,00 $") and keeps
 * out of the date column, which a footer does not.
 */
function continuesTransaction(row: PdfTextRow, laidOut: LaidOutRow, lastRow: PdfTextRow | null) {
  const isNextLine =
    lastRow !== null &&
    lastRow.page === row.page &&
    row.y - lastRow.y <= CONTINUATION_LINE_HEIGHTS * rowHeight(lastRow);
  const hasMoney =
    laidOut.amounts.some(amount => amount.value !== 0) ||
    findStatementAmounts(row.items.map(item => item.text).join(' ')).some(value => value !== 0);
  const reachesDateColumn = (laidOut.text.date ?? []).length > 0;
  return isNextLine && !hasMoney && !reachesDateColumn;
}

/**
 * The table's transactions in page order. Pages without a header of their
 * own continue the columns of the last header seen.
 */
export function readLayoutTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
  const ordered = rows.flatMap(splitOverlappingLines).sort((a, b) => a.page - b.page || a.y - b.y);
  const transactions: LayoutTransaction[] = [];
  let columns: LayoutColumn[] | null = null;
  let current: LayoutTransaction | null = null;
  let lastRow: PdfTextRow | null = null;

  for (const row of ordered) {
    const header = readHeaderRow(row);
    if (header) {
      columns = header;
      current = null;
      continue;
    }
    if (!columns) {
      continue;
    }

    const items = [...row.items].sort((a, b) => a.x - b.x);
    const date = leadingDate(items);
    const laidOut = layOutRow(date ? items.slice(date.used) : items, columns);

    if (date && laidOut.amounts.length > 0) {
      current = openTransaction(date, laidOut);
      transactions.push(current);
      lastRow = row;
    } else if (current && !date && continuesTransaction(row, laidOut, lastRow)) {
      appendText(current, laidOut);
      lastRow = row;
    } else {
      // A totals line, a footer or a gap: whatever follows is not this row's text.
      current = null;
    }
  }

  return transactions;
}

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
