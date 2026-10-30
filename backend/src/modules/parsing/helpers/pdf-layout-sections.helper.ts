import type { PdfTextItem, PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { LayoutColumn } from './pdf-layout-columns.helper';
import { parseStatementAmount } from './statement-amount.helper';
import { foldText, parseDateParts } from './statement-date.helper';

/**
 * Statements that list money in and money out under headings of their own
 * ("Deposits and Other Additions", "Withdrawals and Other Deductions"), each
 * row with one unsigned amount and often no column header, the list closed by
 * a totals line. The heading gives every row under it its sign.
 */

export type SectionSign = 'debit' | 'credit';

export interface LayoutSection {
  sign: SectionSign;
  /** Columns read off the section's first row, when no header row names them. */
  columns?: LayoutColumn[];
}

/** Headings, folded, without "(continued)". */
const SECTIONS: Record<SectionSign, string[]> = {
  credit: [
    'deposits',
    'deposits and additions',
    'deposits and other additions',
    'deposits and other credits',
    'deposits and credits',
    'other deposits',
    'electronic deposits',
    'credits',
    'other credits',
    'additions',
    'other additions',
  ],
  debit: [
    'withdrawals',
    'withdrawals and other deductions',
    'withdrawals and other subtractions',
    'withdrawals and deductions',
    'withdrawals and other debits',
    'other withdrawals',
    'electronic withdrawals',
    'card withdrawals',
    'atm and debit card withdrawals',
    'atm & debit card withdrawals',
    'card purchases',
    'debit card purchases',
    'debits',
    'other debits',
    'deductions',
    'other deductions',
    'other subtractions',
    'fees',
    'service fees',
  ],
};

const SECTION_BY_HEADING = new Map<string, SectionSign>(
  (Object.entries(SECTIONS) as [SectionSign, string[]][]).flatMap(([sign, headings]) =>
    headings.map(heading => [heading, sign] as [string, SectionSign]),
  ),
);

const rowText = (row: PdfTextRow) => row.items.map(item => item.text).join(' ');

/** The sign a section heading gives the rows under it; null for any other line. */
export function readSectionHeading(row: PdfTextRow): SectionSign | null {
  const heading = foldText(rowText(row))
    .replace(/\(?\bcontinued\b\)?/g, '')
    .replace(/[\s:.]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return SECTION_BY_HEADING.get(heading) ?? null;
}

const startsWithDate = (items: PdfTextItem[]) =>
  parseDateParts(items[0].text, 'dmy') !== null || parseDateParts(items[0].text, 'mdy') !== null;

/**
 * Without a header row the section's first row shows its columns: the date
 * first, the text after it, the amount last. Later rows are read against the
 * same columns.
 */
export function sectionColumns(section: LayoutSection, lines: PdfTextRow[]): LayoutColumn[] | null {
  if (section.columns) {
    return section.columns;
  }
  for (const line of lines) {
    const items = [...line.items].sort((a, b) => a.x - b.x);
    const amount = items[items.length - 1];
    if (items.length < 3 || !startsWithDate(items) || parseStatementAmount(amount.text) === null) {
      continue;
    }
    section.columns = [
      { role: 'date', x0: items[0].x, x1: items[0].x + items[0].width },
      { role: 'description', x0: items[1].x, x1: items[items.length - 2].x },
      { role: section.sign, x0: amount.x, x1: amount.x + amount.width },
    ];
    return section.columns;
  }
  return null;
}

/**
 * A wrapped line of a row's text starts under the text column; a footer or a
 * note that happens to sit close below starts elsewhere.
 */
export function alignsWithSectionText(section: LayoutSection | undefined, line: PdfTextRow) {
  const text = section?.columns?.find(column => column.role === 'description');
  if (!text) {
    return true;
  }
  const start = Math.min(...line.items.map(item => item.x));
  return Math.abs(start - text.x0) <= 4;
}

/** A row under a section heading takes the heading's sign, whatever column its amount sits in. */
export function signBySection<T extends { debit?: number; credit?: number; amount?: number }>(
  row: T,
  sign: SectionSign,
): T {
  const value = row.amount ?? row.debit ?? row.credit;
  if (value === undefined) {
    return row;
  }
  const { amount: _amount, debit: _debit, credit: _credit, ...rest } = row;
  return { ...rest, [sign]: Math.abs(value) } as T;
}
