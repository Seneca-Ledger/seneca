import type { ContractType } from '@/app/lib/query-fn-schema';

/**
 * Marking a statement the parser could not read: areas drawn on its pages,
 * each tagged with what it holds. Coordinates are the parser's own, points
 * from the page's top left, so what the user marks is what the parser reads.
 */

export type TeachRegion = ContractType<'TeachRegion'>;
export type TeachTag = TeachRegion['tag'];
export type LayoutWord = ContractType<'StatementLayoutWords'>['words'][number];
export type TeachPreview = ContractType<'TeachLayoutPreview'>;

/** Tags in the order the toolbar shows them; the first nine have number keys. */
export const TEACH_TAGS: TeachTag[] = [
  'date',
  'description',
  'debit',
  'credit',
  'amount',
  'balance',
  'counterparty',
  'header',
  'skip',
  'openingBalance',
  'closingBalance',
  'bankName',
];

/** Each tag's tone: a token, so both themes hold. */
export const TAG_TONE: Record<TeachTag, string> = {
  date: 'var(--merchant-tone-3)',
  description: 'var(--merchant-tone-1)',
  counterparty: 'var(--merchant-tone-7)',
  debit: 'var(--money-down)',
  credit: 'var(--money-up)',
  amount: 'var(--merchant-tone-4)',
  balance: 'var(--merchant-tone-11)',
  header: 'var(--merchant-tone-8)',
  skip: 'var(--cat-tone-other)',
  openingBalance: 'var(--merchant-tone-6)',
  closingBalance: 'var(--merchant-tone-10)',
  bankName: 'var(--merchant-tone-5)',
};

/** Tags for a column of the transactions table, drawn down over its rows. */
const COLUMN_TAGS = new Set<TeachTag>([
  'date',
  'description',
  'counterparty',
  'debit',
  'credit',
  'amount',
  'balance',
]);
/** Tags for one printed figure. */
const ONE_FIGURE_TAGS = new Set<TeachTag>(['openingBalance', 'closingBalance']);

/** Why an area does not look like what its tag stands for. */
export type RegionWarning = 'notColumn' | 'notOneFigure';

/** What a reading cannot do without: each group needs one of its tags. */
export const REQUIRED_TAGS: TeachTag[][] = [
  ['date'],
  ['description'],
  ['debit', 'credit', 'amount'],
];

/** A drag shorter than this, in points, is a click, not an area. */
export const MIN_REGION_SIZE = 4;

export interface Point {
  x: number;
  y: number;
}

export function rectBetween(a: Point, b: Point) {
  return {
    x0: Math.min(a.x, b.x),
    y0: Math.min(a.y, b.y),
    x1: Math.max(a.x, b.x),
    y1: Math.max(a.y, b.y),
  };
}

export function isAreaBigEnough(rect: { x0: number; y0: number; x1: number; y1: number }) {
  return rect.x1 - rect.x0 >= MIN_REGION_SIZE && rect.y1 - rect.y0 >= MIN_REGION_SIZE;
}

/** Words whose middle lies inside the area, as the parser takes them. */
export function wordsInRegion(words: readonly LayoutWord[], region: TeachRegion): LayoutWord[] {
  return words.filter(word => {
    const x = word.x + word.width / 2;
    const y = word.y + word.height / 2;
    return (
      word.page === region.page &&
      x >= region.x0 &&
      x <= region.x1 &&
      y >= region.y0 &&
      y <= region.y1
    );
  });
}

/** Tags of one thing printed once; every other tag may be marked in as many areas as it takes. */
const SINGLE_TAGS = new Set<TeachTag>(['openingBalance', 'closingBalance', 'bankName']);

/**
 * The areas with one more drawn. A column, the header or a skip adds up (the
 * table on every page); a single tag drawn again moves to the new area.
 */
export function withRegion(regions: readonly TeachRegion[], region: TeachRegion): TeachRegion[] {
  const moves = SINGLE_TAGS.has(region.tag);
  return [...regions.filter(other => !moves || other.tag !== region.tag), region];
}

const lineKey = (word: LayoutWord) => `${word.page}:${Math.round(word.y)}`;

/**
 * The first look of an area against its tag, as the parser will judge it:
 * a column crosses at least one transaction row (a line the parser reads as
 * starting with a date, `dated`); one figure is one line with a figure, not
 * a whole column.
 */
export function regionWarning(
  region: TeachRegion,
  words: readonly LayoutWord[],
): RegionWarning | null {
  const lines = new Set(wordsInRegion(words, region).map(lineKey));
  if (COLUMN_TAGS.has(region.tag)) {
    return wordsInRegion(words, region).some(word => word.dated) ? null : 'notColumn';
  }
  if (ONE_FIGURE_TAGS.has(region.tag)) {
    const withFigures = [...lines].filter(key =>
      wordsInRegion(words, region).some(word => lineKey(word) === key && /\d/.test(word.text)),
    );
    return withFigures.length > 1 ? 'notOneFigure' : null;
  }
  return null;
}

/** Required groups no area is tagged with yet. */
export function missingGroups(regions: readonly TeachRegion[]): TeachTag[][] {
  const tags = new Set(regions.map(region => region.tag));
  return REQUIRED_TAGS.filter(group => !group.some(tag => tags.has(tag)));
}

/** The tag to draw next: the first one still required, else the one in hand. */
export function nextTag(regions: readonly TeachRegion[], current: TeachTag): TeachTag {
  return missingGroups(regions)[0]?.[0] ?? current;
}

/** Codes a changed layout leaves behind (statement-validation.helper on the server). */
const LAYOUT_REASONS = new Set([
  'nothing_extracted',
  'no_rows_kept',
  'balance_chain',
  'printed_totals',
  'section_totals',
]);

/**
 * Whether the statement is one to teach rather than show a sum for: a PDF the
 * parser failed on, read nothing from, or read wrongly by its own checks.
 */
export function canTeach(statement: {
  status: string;
  fileType: string;
  source?: string;
  parsingDetails?: { validation?: { reasonCodes?: readonly string[] | null } | null } | null;
}): boolean {
  if (statement.fileType !== 'pdf' || statement.source === 'scan') {
    return false;
  }
  if (statement.status === 'error') {
    return true;
  }
  const reasons = statement.parsingDetails?.validation?.reasonCodes ?? [];
  return statement.status === 'needs_review' && reasons.some(code => LAYOUT_REASONS.has(code));
}
