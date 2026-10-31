import type { PdfTextItem } from '../../../common/utils/pdf-parser.util';
import type { LaidOutRow, LayoutColumn } from './pdf-layout-columns.helper';
import { type DateParts, parseDateParts } from './statement-date.helper';
import { isTotalsLabel } from './statement-metadata.helper';

/** Up to three leading words that make one date ("02 janv. 25"); longest first. */
export function leadingDate(
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

/**
 * Whether a row's first word stands where its date can: left of the
 * description, when the table prints the date column before it.
 */
export function startsLeftOfText(first: PdfTextItem, columns: readonly LayoutColumn[]): boolean {
  const date = columns.find(column => column.role === 'date');
  const text = columns.find(column => column.role === 'description');
  return !(date && text && date.x0 < text.x0) || first.x < text.x0;
}

/** A row's date: its parts, and the date as printed. */
export type RowDate = { parts: DateParts; text: string };

/**
 * How lines become transactions. `dated`: a dated line with money opens one,
 * and so does a line of text and money right under one (the same day's next
 * payment). `strict`: only a dated line. `money`: any line with text and
 * money, dated by the last date printed above it. The reader tries each and
 * keeps the one the statement's own checks agree with (pdf-layout-rules).
 */
export type RowRule = 'dated' | 'strict' | 'money';

/**
 * The date of a line printed without one that is still a transaction of its
 * own: a statement that prints the date once per day lists that day's other
 * payments right under it, each with its text and money ("06 Sep  ACME Store
 * 57.77" over "ACME Cafe  28.27  894,542.94"). The line must follow (`follows`)
 * a row dated `day`, carry text in the description column and money in a money
 * column, and keep out of the date column; a totals line is not one.
 */
export function sameDayDate(
  day: RowDate | null,
  laidOut: LaidOutRow,
  follows: boolean,
): RowDate | null {
  const text = (laidOut.text.description ?? []).join(' ').trim();
  const movesMoney = laidOut.amounts.some(cell => cell.role !== 'balance' && cell.value !== 0);
  if (
    !(day && follows && text && movesMoney) ||
    (laidOut.text.date ?? []).length > 0 ||
    isTotalsLabel(text)
  ) {
    return null;
  }
  return day;
}
