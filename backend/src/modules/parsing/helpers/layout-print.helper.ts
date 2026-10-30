import type { PdfTextItem, PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { TaughtHeadings } from './pdf-layout-columns.helper';
import { readHeaderRow } from './pdf-layout-columns.helper';
import { detectStatementCurrency } from './statement-metadata.helper';

/**
 * How a statement prints, read off the file a layout was taught on: the shape
 * of its dates and amounts (digits as #), how its rows and pages run, and its
 * type. Never a figure, a name or a description. The parser needs none of
 * it; an invented statement printed the same way (scripts/layout-to-golden.mjs)
 * tests what the bank's real files will put to the parser.
 */
export interface LayoutPrint {
  /** The most common date, digits as # ("##-##-####", "## Feb ####"). */
  dateShape?: string;
  amounts?: {
    /** "." or "," before the cents. */
    decimal: string;
    /** Between thousands: ",", ".", " ", "'" or none. */
    thousands: string;
    /** How money out is marked where an amount carries a sign. */
    negative: 'minus' | 'trailing-minus' | 'parentheses' | 'none';
    /** Marks printed with amounts ("CR", "DR"), if any. */
    marks: string[];
  };
  /** Lines a description usually takes. */
  descriptionLines: number;
  /** Pages with rows, and whether each repeats the column headings. */
  pages: number;
  headerOnEveryPage: boolean;
  /** Type size and the distance between rows, in points. */
  fontSize?: number;
  rowGap?: number;
  currency?: string;
}

type Area = { tag: string; page: number; x0: number; y0: number; x1: number; y1: number };

const MONEY_TAGS = ['debit', 'credit', 'amount', 'balance'];
const DATE_SHAPE = /^[#\p{L} .,/'-]{4,24}$/u;
const MARK = /^[A-Za-z]{2,3}$/;

const inArea = (item: PdfTextItem, area: Area) => {
  const x = item.x + item.width / 2;
  const y = item.y + item.height / 2;
  return x >= area.x0 && x <= area.x1 && y >= area.y0 && y <= area.y1;
};
const linesOf = (rows: PdfTextRow[], area: Area) =>
  rows.filter(row => row.page === area.page && row.items.some(item => inArea(item, area)));
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : undefined;
};
const mostCommon = (values: string[]) => {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
};
const round1 = (value: number | undefined) =>
  value === undefined ? undefined : Math.round(value * 10) / 10;

/** The cells of the date column, as shapes: digits as #, words kept. */
function dateShape(rows: PdfTextRow[], date: Area | undefined): string | undefined {
  if (!date) {
    return undefined;
  }
  const cells = linesOf(rows, date)
    .map(row =>
      row.items
        .filter(item => inArea(item, date))
        .map(item => item.text)
        .join(' '),
    )
    .filter(cell => /\d/.test(cell))
    .map(cell => cell.replace(/\d/g, '#'));
  const shape = mostCommon(cells);
  return shape && DATE_SHAPE.test(shape) ? shape : undefined;
}

/** How the money columns print: separators, the minus, and marks such as "CR". */
function amountFormat(rows: PdfTextRow[], money: Area[]): LayoutPrint['amounts'] {
  const words = money.flatMap(area =>
    rows.flatMap(row => row.items.filter(item => inArea(item, area))),
  );
  const figures = words.map(word => word.text).filter(text => /\d/.test(text));
  if (figures.length === 0) {
    return undefined;
  }
  const decimal = mostCommon(figures.map(text => /([.,])\d{2}\)?-?$/.exec(text)?.[1] ?? '')) ?? '';
  const grouped = figures
    .map(text => /\d([,. '’])\d{3}(?:\D|$)/.exec(text)?.[1])
    .filter((sep): sep is string => sep !== undefined && sep !== decimal);
  const negative = figures.some(text => /^\(.*\)$/.test(text))
    ? 'parentheses'
    : figures.some(text => /^[-−]/.test(text))
      ? 'minus'
      : figures.some(text => /\d[-−]$/.test(text))
        ? 'trailing-minus'
        : 'none';
  const marks = [
    ...new Set(
      words
        .map(word => word.text)
        .filter(text => MARK.test(text))
        .map(text => text.toUpperCase()),
    ),
  ].slice(0, 4);
  return { decimal, thousands: mostCommon(grouped) ?? '', negative, marks };
}

/** What the marked areas show of how the statement prints. */
export function layoutPrint(
  rows: PdfTextRow[],
  regions: readonly Area[],
  headings: TaughtHeadings,
): LayoutPrint {
  const date = regions.find(region => region.tag === 'date');
  const description = regions.find(region => region.tag === 'description');
  const money = regions.filter(region => MONEY_TAGS.includes(region.tag));
  const datedRows = date
    ? linesOf(rows, date).filter(row =>
        row.items.some(item => inArea(item, date) && /\d/.test(item.text)),
      )
    : [];
  // Pages with rows: any line, on any page, that starts with a date of this shape.
  const shape = dateShape(rows, date);
  const startsDated = shape
    ? new RegExp(`^${shape.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&').replace(/#/g, '\\d')}`)
    : null;
  const datedPages = new Set(
    rows.filter(row => startsDated?.test(row.text.trim())).map(row => row.page),
  );
  const headerPages = new Set(
    rows.filter(row => readHeaderRow(row, headings)).map(row => row.page),
  );
  const descriptionLines = description ? linesOf(rows, description).length : 0;
  const gaps = datedRows
    .slice(1)
    .map((row, index) => row.y - datedRows[index].y)
    .filter(gap => gap > 0);
  return {
    dateShape: shape,
    amounts: amountFormat(rows, money),
    descriptionLines:
      datedRows.length > 0 ? Math.max(1, Math.round(descriptionLines / datedRows.length)) : 1,
    pages: datedPages.size,
    headerOnEveryPage: [...datedPages].every(page => headerPages.has(page)),
    fontSize: round1(median(datedRows.flatMap(row => row.items.map(item => item.height)))),
    rowGap: round1(median(gaps)),
    currency: detectStatementCurrency(rows.map(row => row.text).join('\n')) ?? undefined,
  };
}
