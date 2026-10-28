import { createHash } from 'crypto';
import type { PdfTextItem, PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { ParsedStatement } from '../interfaces/parsed-statement.interface';
import { type ColumnRole, headingWord, type LayoutColumn } from './pdf-layout-columns.helper';
import type { LayoutReading } from './pdf-layout-table.helper';
import { findStatementAmounts } from './statement-amount.helper';
import { foldText } from './statement-date.helper';

/**
 * A layout a user taught by marking areas of a statement the parser could not
 * read: which column holds what, the header line, lines to skip and where the
 * balances are printed. Only the statement's printed words for headings and
 * labels are kept, and where its columns sit: never a figure, a name or a
 * description from the rows.
 */

export const COLUMN_TAGS = [
  'date',
  'description',
  'counterparty',
  'debit',
  'credit',
  'amount',
  'balance',
] as const;
export const TEACH_TAGS = [
  ...COLUMN_TAGS,
  'header',
  'skip',
  'openingBalance',
  'closingBalance',
] as const;
export type TeachTag = (typeof TEACH_TAGS)[number];
type ColumnTag = (typeof COLUMN_TAGS)[number];

/** An area the user marked, in the words' coordinates: points from the page's top left. */
export interface TeachRegion {
  tag: TeachTag;
  page: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface LayoutTemplate {
  /** Header phrases, folded as the header reader folds them, and the column each heads. */
  headings: { phrase: string; role: ColumnRole }[];
  /** Where each column sits, for a table printed without a header. */
  columns: { role: ColumnRole; x0: number; x1: number }[];
  /** Words of lines that are no part of the table, folded, without figures. */
  skip: string[];
  /** The label printed before each balance. */
  balances: { start?: string; end?: string };
}

/** The tags a reading cannot do without. */
const REQUIRED: TeachTag[][] = [['date'], ['description'], ['debit', 'credit', 'amount']];
const MONEY_TAGS: TeachTag[] = ['debit', 'credit', 'amount', 'balance'];
/** A skip phrase shorter than this ("cr", "-") would skip rows it was never meant for. */
const MIN_SKIP_LENGTH = 3;
/** A label is the last few words before the balance. */
const LABEL_WORDS = 4;
/** Checks a changed layout breaks: a reading failing one is no good reading. */
const FORMAT_CHECKS = new Set(['balance_chain', 'printed_totals', 'section_totals']);

const isColumnTag = (tag: TeachTag): tag is ColumnTag =>
  (COLUMN_TAGS as readonly TeachTag[]).includes(tag);
const hasDigit = (text: string) => /\d/.test(text);
const right = (item: PdfTextItem) => item.x + item.width;

/** Groups of tags still missing for a reading, each a choice of one ("debit|credit|amount"). */
export function missingTags(regions: readonly TeachRegion[]): string[] {
  const tags = new Set(regions.map(region => region.tag));
  return REQUIRED.filter(group => !group.some(tag => tags.has(tag))).map(group => group.join('|'));
}

/**
 * How good a reading is: 0 without rows, 1 with rows a format check finds
 * wrong (the running balance, the printed totals), 2 otherwise.
 */
export function readingScore(parsed: Pick<ParsedStatement, 'transactions' | 'checks'>): number {
  if (parsed.transactions.length === 0) {
    return 0;
  }
  const broken = (parsed.checks ?? []).some(
    check => !check.passed && FORMAT_CHECKS.has(check.code),
  );
  return broken ? 1 : 2;
}
export const GOOD_READING = 2;

/** Words whose middle lies inside the area. */
export function wordsIn(rows: PdfTextRow[], region: TeachRegion): PdfTextItem[] {
  return rows
    .filter(row => row.page === region.page)
    .flatMap(row => row.items)
    .filter(item => {
      const x = item.x + item.width / 2;
      const y = item.y + item.height / 2;
      return x >= region.x0 && x <= region.x1 && y >= region.y0 && y <= region.y1;
    });
}

/** Words of a line that sit over the column's span, left to right. */
function inBand(row: PdfTextRow, region: TeachRegion): PdfTextItem[] {
  return row.items
    .filter(item => right(item) > region.x0 && item.x < region.x1)
    .sort((a, b) => a.x - b.x);
}

const phraseOf = (items: PdfTextItem[]) => items.map(headingWord).filter(Boolean).join(' ');

const plainOver = (row: PdfTextRow, region: TeachRegion) => {
  const words = inBand(row, region);
  return words.length > 0 && !words.some(word => hasDigit(word.text));
};

/**
 * The header's lines: those the user marked, or else the nearest line above
 * the first dated row with plain words (no figure) over at least two of the
 * marked columns ("Tran Date  Particulars  Debit" above "28-08-2023 …").
 */
function headerLines(rows: PdfTextRow[], regions: readonly TeachRegion[]): PdfTextRow[] {
  const header = regions.find(region => region.tag === 'header');
  if (header) {
    return rows.filter(
      row => row.page === header.page && row.y + 1 >= header.y0 && row.y <= header.y1,
    );
  }
  const date = regions.find(region => region.tag === 'date');
  if (!date) {
    return [];
  }
  const onPage = rows.filter(row => row.page === date.page).sort((a, b) => a.y - b.y);
  const firstDated = onPage.find(
    row =>
      row.y + 1 >= date.y0 &&
      row.y <= date.y1 &&
      inBand(row, date).some(word => hasDigit(word.text)),
  );
  const columns = regions.filter(region => isColumnTag(region.tag));
  const line = onPage
    .filter(row => firstDated && row.y < firstDated.y)
    .reverse()
    .find(row => columns.filter(region => plainOver(row, region)).length >= 2);
  return line ? [line] : [];
}

/** The column's heading: the header's plain words over it, line by line. */
function headingFor(header: PdfTextRow[], region: TeachRegion): string {
  return phraseOf(header.flatMap(row => inBand(row, region).filter(word => !hasDigit(word.text))));
}

/**
 * Where the column sits. Money is matched by its right edge, so a money
 * column ends where the rightmost figure in the area ends.
 */
function columnFor(rows: PdfTextRow[], region: TeachRegion & { tag: ColumnTag }) {
  const words = wordsIn(rows, region);
  const edge = Math.max(...words.filter(word => hasDigit(word.text)).map(right));
  const x1 = MONEY_TAGS.includes(region.tag) && Number.isFinite(edge) ? edge : region.x1;
  return { role: region.tag as ColumnRole, x0: region.x0, x1 };
}

/** The words before the marked balance on its line, or the line above it when there are none. */
function labelFor(rows: PdfTextRow[], region: TeachRegion): string | undefined {
  const lines = rows
    .filter(row => row.page === region.page && row.y <= region.y1)
    .sort((a, b) => b.y - a.y);
  for (const line of lines) {
    const before = line.items
      .filter(item => item.x < region.x0 || line.y < region.y0)
      .filter(item => !hasDigit(item.text))
      .sort((a, b) => a.x - b.x)
      .slice(-LABEL_WORDS);
    if (before.length > 0) {
      return foldText(before.map(item => item.text).join(' '));
    }
  }
  return undefined;
}

/** A line's words without figures, folded. */
const plainWords = (items: PdfTextItem[]) =>
  foldText(
    items
      .filter(item => !hasDigit(item.text))
      .map(item => item.text)
      .join(' '),
  );

/** Each line inside a skipped area, as its words without figures. */
function skipPhrases(rows: PdfTextRow[], region: TeachRegion): string[] {
  return rows
    .filter(row => row.page === region.page && row.y >= region.y0 && row.y <= region.y1)
    .map(row => plainWords(wordsIn([row], region)))
    .filter(phrase => phrase.length >= MIN_SKIP_LENGTH);
}

/** The template the marked areas teach, read off the statement's own words. */
export function templateFromRegions(
  regions: readonly TeachRegion[],
  rows: PdfTextRow[],
): LayoutTemplate {
  const header = headerLines(rows, regions);
  const columnRegions = regions.filter((region): region is TeachRegion & { tag: ColumnTag } =>
    isColumnTag(region.tag),
  );
  const headings = columnRegions
    .map(region => ({ phrase: headingFor(header, region), role: region.tag as ColumnRole }))
    .filter(heading => heading.phrase);
  const balance = (tag: TeachTag) => {
    const region = regions.find(candidate => candidate.tag === tag);
    return region ? labelFor(rows, region) : undefined;
  };
  return {
    headings,
    columns: columnRegions.map(region => columnFor(rows, region)).sort((a, b) => a.x0 - b.x0),
    skip: [
      ...new Set(
        regions
          .filter(region => region.tag === 'skip')
          .flatMap(region => skipPhrases(rows, region)),
      ),
    ],
    balances: { start: balance('openingBalance'), end: balance('closingBalance') },
  };
}

/** One value per taught layout: its headings and columns, not where it was taught. */
export function templateSignature(template: LayoutTemplate): string {
  const lines = [
    ...template.headings.map(heading => `${heading.role}:${heading.phrase}`).sort(),
    template.columns.map(column => column.role).join(','),
  ];
  return createHash('sha256').update(lines.join('\n')).digest('hex').slice(0, 12);
}

/** How the table reader takes the template. */
export function layoutReading(template: LayoutTemplate): LayoutReading {
  const columns: LayoutColumn[] = template.columns.map(column => ({ ...column }));
  return {
    headings: new Map(template.headings.map(heading => [heading.phrase, heading.role])),
    columns: columns.length > 0 ? columns : undefined,
    skip:
      template.skip.length > 0
        ? row => template.skip.some(phrase => plainWords(row.items).includes(phrase))
        : undefined,
  };
}

/**
 * Whether a statement may be in the taught layout: its text carries at least
 * two of the taught headings as whole words. A template taught without
 * headings may fit any file.
 */
export function templateFits(template: LayoutTemplate, text: string): boolean {
  if (template.headings.length === 0) {
    return true;
  }
  const words = ` ${foldText(text).replace(/\s+/g, ' ')} `;
  const found = template.headings.filter(heading => words.includes(` ${heading.phrase} `));
  return found.length >= Math.min(2, template.headings.length);
}

/** The amount printed after a taught label, on the label's own line. */
export function labelledBalance(rows: PdfTextRow[], label: string | undefined): number | null {
  if (!label) {
    return null;
  }
  for (const row of rows) {
    const at = foldText(row.text).indexOf(label);
    if (at !== -1) {
      const [value] = findStatementAmounts(row.text.slice(at + label.length));
      if (value !== undefined) {
        return value;
      }
    }
  }
  return null;
}
