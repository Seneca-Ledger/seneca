import type { PdfTextItem, PdfTextRow } from '../../../common/utils/pdf-parser.util';
import {
  type LaidOutRow,
  type LayoutColumn,
  layOutRow,
  readHeaderRow,
} from './pdf-layout-columns.helper';
import { attachLeadInLines } from './pdf-layout-lead-in.helper';
import {
  alignsWithSectionText,
  type LayoutSection,
  readSectionHeading,
  type SectionSign,
  sectionColumns,
  signBySection,
} from './pdf-layout-sections.helper';
import { joinStackedHeaders } from './pdf-layout-stacked-header.helper';
import { groupWrappedLines, mergeLaidOut, rowHeight } from './pdf-layout-wrapped.helper';
import { findStatementAmounts } from './statement-amount.helper';
import { type DateParts, parseDateParts } from './statement-date.helper';
import { isBalanceLabel, readAccountHeading } from './statement-metadata.helper';

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
  /** The part of `description` printed on the dated row itself. */
  firstLine: string;
  counterparty: string;
  counterpartyAccount?: string;
  debit?: number;
  credit?: number;
  /** Signed, from a single amount column. */
  amount?: number;
  /** Running balance after this row, when the table prints one. */
  balance?: number;
  /** The account heading printed above this row's table, if any. */
  account?: { accountNumber: string; currency?: string };
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
    firstLine: '',
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
  transaction.firstLine = transaction.description;
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

/**
 * Whether a line without its own date adds to the transaction above it: it
 * sits right under the previous line, carries no money (money anywhere makes
 * it a totals line or a note such as "Frais sur compte: 23,00 $") and keeps
 * out of the date column, which a footer does not.
 */
function isNextLine(row: PdfTextRow, lastRow: PdfTextRow | null): boolean {
  return (
    lastRow !== null &&
    lastRow.page === row.page &&
    row.y - lastRow.y <= CONTINUATION_LINE_HEIGHTS * rowHeight(lastRow)
  );
}

function continuesTransaction(row: PdfTextRow, laidOut: LaidOutRow, lastRow: PdfTextRow | null) {
  const hasMoney =
    laidOut.amounts.some(amount => amount.value !== 0) ||
    findStatementAmounts(row.items.map(item => item.text).join(' ')).some(value => value !== 0);
  const reachesDateColumn = (laidOut.text.date ?? []).length > 0;
  return isNextLine(row, lastRow) && !hasMoney && !reachesDateColumn;
}

/**
 * An account heading sits between tables, without money on its line. Right
 * under a transaction row it is that row's text ("Transfer to account
 * 1234-5678"), not a new account.
 */
function accountHeadingAt(row: PdfTextRow, rowAbove: PdfTextRow | null) {
  const text = row.items.map(item => item.text).join(' ');
  if (isNextLine(row, rowAbove) || findStatementAmounts(text).length > 0) {
    return null;
  }
  return readAccountHeading(text);
}

/** A row's leading date, if any, and the rest of its words by column. */
function readTableRow(row: PdfTextRow, columns: LayoutColumn[]) {
  const items = [...row.items].sort((a, b) => a.x - b.x);
  const date = leadingDate(items);
  return { date, laidOut: layOutRow(date ? items.slice(date.used) : items, columns) };
}

/**
 * The table's transactions in page order. Pages without a header of their
 * own continue the columns of the last header seen.
 */
export function readLayoutTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
  return readLayoutTable(rows).transactions;
}

/** A deposits or withdrawals section closed by its totals line: printed and read. */
export interface SectionTotal {
  sign: SectionSign;
  printed: number;
  read: number;
}

/**
 * The transactions, the totals lines of the sections they were read under,
 * and the layout itself: every table header read and every section heading,
 * in page order.
 */
export function readLayoutTable(rows: PdfTextRow[]): {
  transactions: LayoutTransaction[];
  sections: SectionTotal[];
  layout: { headers: LayoutColumn[][]; sections: SectionSign[] };
} {
  const ordered = joinStackedHeaders(
    rows.flatMap(splitOverlappingLines).sort((a, b) => a.page - b.page || a.y - b.y),
  );
  const state: ReadingState = {
    transactions: [],
    columns: null,
    current: null,
    lastRow: null,
    sections: [],
    sectionRead: 0,
    layout: { headers: [], sections: [] },
  };
  const dateWords = (row: PdfTextRow) =>
    leadingDate([...row.items].sort((a, b) => a.x - b.x))?.used ?? 0;
  const isHeading = (row: PdfTextRow) =>
    Boolean(readHeaderRow(row) || readSectionHeading(row) || readAccountHeading(row.text));
  for (const lines of attachLeadInLines(groupWrappedLines(ordered), dateWords, isHeading)) {
    readRow(state, lines);
  }
  return { transactions: state.transactions, sections: state.sections, layout: state.layout };
}

interface ReadingState {
  transactions: LayoutTransaction[];
  columns: LayoutColumn[] | null;
  /** The transaction the next lines may still add text to. */
  current: LayoutTransaction | null;
  /** The last line that belonged to `current`. */
  lastRow: PdfTextRow | null;
  /** A dated line without money, waiting for the line under it to bring the amounts. */
  pending?: PdfTextRow[];
  account?: LayoutTransaction['account'];
  /** The deposits or withdrawals heading the rows sit under, up to its totals line. */
  section?: LayoutSection;
  /** What the rows of `section` add up to so far, and the sections closed by a total. */
  sectionRead: number;
  sections: SectionTotal[];
  layout: { headers: LayoutColumn[][]; sections: SectionSign[] };
}

function readRow(state: ReadingState, lines: PdfTextRow[]) {
  const [row] = lines;
  if (lines.length > 1 && lines.some(line => readHeaderRow(line) || accountHeadingAt(line, null))) {
    // A heading is never part of a wrapped cell: read each line on its own.
    for (const line of lines) {
      readRow(state, [line]);
    }
    return;
  }
  // An account heading or a table header starts a new table.
  const heading = accountHeadingAt(row, state.current ? state.lastRow : null);
  const header = heading ? null : readHeaderRow(row);
  const section = heading || header ? null : readSectionHeading(row);
  if (section) {
    // A section's own header row, if it prints one, follows its heading.
    // "Withdrawals (continued)" on the next page goes on adding to the same total.
    state.sectionRead = state.section?.sign === section ? state.sectionRead : 0;
    state.section = { sign: section };
    state.layout.sections.push(section);
    state.columns = null;
    state.current = null;
    return;
  }
  if (heading || header) {
    state.account = heading ?? state.account;
    state.columns = header ?? state.columns;
    if (header) {
      state.layout.headers.push(header);
    }
    state.current = null;
    return;
  }
  const columns = state.columns ?? (state.section ? sectionColumns(state.section, lines) : null);
  if (!columns) {
    return;
  }

  const read = lines.map(line => readTableRow(line, columns));
  const date = read.find(line => line.date)?.date ?? null;
  const laidOut = mergeLaidOut(read.map(line => line.laidOut));
  const pending = state.pending;
  state.pending = undefined;
  if (date && laidOut.amounts.length === 0) {
    // "12 FEB ANZ ATM" over "GRIFFITH BRANCH 500.00 12,339.24": the date heads the row.
    state.pending = lines;
    state.current = null;
    return;
  }
  if (
    !date &&
    laidOut.amounts.length > 0 &&
    pending &&
    isNextLine(lines[0], pending.at(-1) ?? null)
  ) {
    readRow(state, [...pending, ...lines]);
    return;
  }
  const dated = date && laidOut.amounts.length > 0 ? openTransaction(date, laidOut) : null;
  if (dated && lines.length > 1) {
    // A row of several lines: only the dated line's own words are its first line.
    dated.firstLine = (read.find(line => line.date)?.laidOut.text.description ?? []).join(' ');
  }
  const opened = dated && state.section ? signBySection(dated, state.section.sign) : dated;
  const continues = read.every(
    (line, index) =>
      continuesTransaction(
        lines[index],
        line.laidOut,
        index === 0 ? state.lastRow : lines[index - 1],
      ) && alignsWithSectionText(state.section, lines[index]),
  );
  if (opened && (isBalanceLine(opened) || isBalanceLabel(opened.description))) {
    // "01/06/2023 Beginning Balance $4,082.88": the balance, not a movement.
    state.current = null;
  } else if (opened) {
    state.current = { ...opened, account: state.account };
    state.transactions.push(state.current);
    state.sectionRead += Math.abs((opened.credit ?? 0) - (opened.debit ?? 0));
    state.lastRow = lines[lines.length - 1];
  } else if (state.current && !date && continues) {
    appendText(state.current, laidOut);
    state.lastRow = lines[lines.length - 1];
  } else {
    // A totals line, a footer or a gap: whatever follows is not this row's text.
    // Money on an undated line is the section's total, which closes it.
    if (state.section && !date && laidOut.amounts.length > 0) {
      const [total] = laidOut.amounts;
      // A heading in a summary ("Deposits 15,450.75") closes with no rows read under it.
      if (laidOut.amounts.length === 1 && state.sectionRead > 0) {
        state.sections.push({
          sign: state.section.sign,
          printed: Math.abs(total.value),
          read: state.sectionRead,
        });
      }
      state.section = undefined;
    }
    state.current = null;
  }
}

function isBalanceLine(transaction: LayoutTransaction): boolean {
  return (
    transaction.debit === undefined &&
    transaction.credit === undefined &&
    transaction.amount === undefined
  );
}
