import { createHash } from 'crypto';
import type { PdfTextItem, PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { ParsedStatement } from '../interfaces/parsed-statement.interface';
import { type LayoutPrint, layoutPrint } from './layout-print.helper';
import { type ColumnRole, headingWord, type LayoutColumn } from './pdf-layout-columns.helper';
import { leadingDate } from './pdf-layout-row-date.helper';
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
  'bankName',
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
  /** The bank's name as the statement prints it, for a bank no parser knows. */
  institution?: string;
  /** How the statement prints (layout-print.helper): shapes and spacing, no figures. */
  print?: LayoutPrint;
}

/** The tags a reading cannot do without. */
const REQUIRED: TeachTag[][] = [['date'], ['description'], ['debit', 'credit', 'amount']];
const MONEY_TAGS: TeachTag[] = ['debit', 'credit', 'amount', 'balance'];
/** A skip phrase shorter than this ("cr", "-") would skip rows it was never meant for. */
const MIN_SKIP_LENGTH = 3;
/** A label is the last few words before the balance. */
const LABEL_WORDS = 4;
/** A bank's name is a few words; more is a sentence the user caught along. */
const MAX_INSTITUTION_LENGTH = 80;
/** Checks a changed layout breaks: a reading failing one is no good reading. */
const FORMAT_CHECKS = new Set(['balance_chain', 'printed_totals', 'section_totals']);

const isColumnTag = (tag: TeachTag): tag is ColumnTag =>
  (COLUMN_TAGS as readonly TeachTag[]).includes(tag);
const hasDigit = (text: string) => /\d/.test(text);
/** A transaction row: its first words are a date ("02 Sep"). A label never comes from one. */
const startsWithDate = (row: PdfTextRow) =>
  leadingDate([...row.items].sort((a, b) => a.x - b.x)) !== null;
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
 * The header's lines: the nearest line above the first transaction row with
 * plain words (no figure) over at least two of the marked columns ("Tran
 * Date  Particulars  Debit" above "28-08-2023 …"). A marked header is taken
 * when it holds that line (a heading printed on two lines), or when there is
 * none; a bank's name or a title marked as the header is not.
 */
function headerLines(rows: PdfTextRow[], regions: readonly TeachRegion[]): PdfTextRow[] {
  const columns = regions.filter(region => isColumnTag(region.tag));
  const overColumns = (row: PdfTextRow) =>
    columns.filter(region => plainOver(row, region)).length >= 2;
  const header = regions.find(region => region.tag === 'header');
  const marked = header
    ? rows.filter(row => row.page === header.page && row.y + 1 >= header.y0 && row.y <= header.y1)
    : [];
  const line = headingLineAbove(rows, regions, overColumns);
  if (line) {
    return marked.includes(line) ? marked : [line];
  }
  return marked.some(overColumns) ? marked : [];
}

/** The nearest line over the columns above the first dated row of the date column. */
function headingLineAbove(
  rows: PdfTextRow[],
  regions: readonly TeachRegion[],
  overColumns: (row: PdfTextRow) => boolean,
): PdfTextRow | undefined {
  const date = regions.find(region => region.tag === 'date');
  if (!date) {
    return undefined;
  }
  const onPage = rows.filter(row => row.page === date.page).sort((a, b) => a.y - b.y);
  const firstDated = onPage.find(
    row =>
      row.y + 1 >= date.y0 &&
      row.y <= date.y1 &&
      inBand(row, date).some(word => hasDigit(word.text)),
  );
  return onPage
    .filter(row => firstDated && row.y < firstDated.y)
    .reverse()
    .find(overColumns);
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

/** The lines an area crosses. */
const linesIn = (rows: PdfTextRow[], region: TeachRegion) =>
  rows.filter(row => wordsIn([row], region).length > 0);

/** A label printed over its figure sits no further above it than this, in points. */
const LABEL_LINE_GAP = 14;

const plainLast = (items: PdfTextItem[]) =>
  items
    .filter(item => !hasDigit(item.text))
    .sort((a, b) => a.x - b.x)
    .slice(-LABEL_WORDS);

/**
 * The label of the one figure the area holds: words the user drew around
 * with it ("Brought forward 1,000.00"), else the words before it on its line,
 * else the line right above it, over the figure. An area over no figure or
 * several (a column) has none, and a transaction row is never a label.
 */
function labelFor(rows: PdfTextRow[], region: TeachRegion): string | undefined {
  const figures = linesIn(rows, region).filter(row =>
    wordsIn([row], region).some(word => hasDigit(word.text)),
  );
  const [line] = figures;
  if (figures.length !== 1 || startsWithDate(line)) {
    return undefined;
  }
  const inside = plainLast(wordsIn([line], region));
  const before = plainLast(line.items.filter(item => right(item) <= region.x0));
  const above = rows
    .filter(row => row.page === line.page && row.y < line.y && line.y - row.y <= LABEL_LINE_GAP)
    .filter(row => !startsWithDate(row))
    .sort((a, b) => b.y - a.y)[0];
  const over = above ? plainLast(inBand(above, region)) : [];
  const words = [inside, before, over].find(found => found.length > 0);
  return words ? foldText(words.map(item => item.text).join(' ')) : undefined;
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
  marked: readonly TeachRegion[],
  rows: PdfTextRow[],
): LayoutTemplate {
  // A column area crosses a transaction row; one over a title or a summary
  // line ("Brought forward 1,000.00") is no column and teaches nothing.
  const regions = oneOfSingleTags(marked).filter(
    region => !isColumnTag(region.tag) || linesIn(rows, region).some(startsWithDate),
  );
  const header = headerLines(rows, regions);
  const columnRegions = regions.filter((region): region is TeachRegion & { tag: ColumnTag } =>
    isColumnTag(region.tag),
  );
  const headings = columnRegions
    .map(region => ({ phrase: headingFor(header, region), role: region.tag as ColumnRole }))
    .filter(
      (heading, index, all) =>
        heading.phrase &&
        all.findIndex(other => other.phrase === heading.phrase && other.role === heading.role) ===
          index,
    );
  const balance = (tag: TeachTag) => {
    const region = regions.find(candidate => candidate.tag === tag);
    return region ? labelFor(rows, region) : undefined;
  };
  return {
    headings,
    columns: oneColumnPerRole(columnRegions.map(region => columnFor(rows, region))),
    skip: [
      ...new Set(
        regions
          .filter(region => region.tag === 'skip')
          .flatMap(region => skipPhrases(rows, region)),
      ),
    ],
    balances: { start: balance('openingBalance'), end: balance('closingBalance') },
    institution: institutionIn(
      rows,
      regions.find(region => region.tag === 'bankName'),
    ),
    print: layoutPrint(rows, regions, new Map(headings.map(h => [h.phrase, h.role]))),
  };
}

/** Tags of one thing printed once: drawing one again moves it. Columns, the header and skips add up. */
const SINGLE_TAGS: TeachTag[] = ['openingBalance', 'closingBalance', 'bankName'];

function oneOfSingleTags(regions: readonly TeachRegion[]): TeachRegion[] {
  return regions.filter(
    (region, index) =>
      !(
        SINGLE_TAGS.includes(region.tag) &&
        regions.slice(index + 1).some(later => later.tag === region.tag)
      ),
  );
}

/** A column marked in several areas (down several pages) spans them all. */
function oneColumnPerRole(columns: { role: ColumnRole; x0: number; x1: number }[]) {
  const byRole = new Map<ColumnRole, { role: ColumnRole; x0: number; x1: number }>();
  for (const column of columns) {
    const seen = byRole.get(column.role);
    byRole.set(
      column.role,
      seen
        ? { role: column.role, x0: Math.min(seen.x0, column.x0), x1: Math.max(seen.x1, column.x1) }
        : column,
    );
  }
  return [...byRole.values()].sort((a, b) => a.x0 - b.x0);
}

/** The bank's name: the area's words without figures (an address or a date is not it). */
function institutionIn(rows: PdfTextRow[], region: TeachRegion | undefined): string | undefined {
  const words = region ? wordsIn(rows, region).filter(item => !hasDigit(item.text)) : [];
  const name = words
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map(item => item.text)
    .join(' ')
    .trim();
  return name && name.length <= MAX_INSTITUTION_LENGTH ? name : undefined;
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
  const columns = boundTextColumns(template.columns.map(column => ({ ...column })));
  return {
    headings: new Map(template.headings.map(heading => [heading.phrase, heading.role])),
    columns: columns.length > 0 ? columns : undefined,
    skip:
      template.skip.length > 0
        ? row => template.skip.some(phrase => plainWords(row.items).includes(phrase))
        : undefined,
  };
}

/** Columns the reader takes as text. */
const TEXT_TAGS: ColumnRole[] = ['date', 'description', 'counterparty'];

/**
 * A text column ends where its area ends: a word right of it that no marked
 * column holds (a running balance the user left unmarked) is no part of the
 * description, so an `other` column takes it.
 */
function boundTextColumns(columns: LayoutColumn[]): LayoutColumn[] {
  const sorted = [...columns].sort((a, b) => a.x0 - b.x0);
  const bounds = sorted
    .filter(column => TEXT_TAGS.includes(column.role))
    .filter(column => !sorted.some(other => other.x0 > column.x0 && other.x0 <= column.x1 + 1))
    .map(column => ({ role: 'other' as const, x0: column.x1 + 1, x1: column.x1 + 1 }));
  return [...sorted, ...bounds].sort((a, b) => a.x0 - b.x0);
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
