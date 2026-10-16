/**
 * The Overview tab as rows of sections. A row has room for four units: a card
 * takes two, a KPI tile one. So a row holds one card (full width), two cards
 * (halves), a card and up to two tiles, or up to four tiles — and whatever a
 * row holds fills it, which is what makes a moved section narrower or wider.
 */

export const KPI_SECTION_IDS = ['kpi-income', 'kpi-spent', 'kpi-net', 'kpi-savings'] as const;

export type KpiSectionId = (typeof KPI_SECTION_IDS)[number];

/** Sections drawn as tiles: a quarter of a row each. */
const TILE_SECTION_IDS = [...KPI_SECTION_IDS, 'safe-to-spend'] as const;

/**
 * Widgets someone switches on from the picker; until then they stay off the
 * Overview, so it does not fill up with cards most people never asked for.
 */
export const OFF_BY_DEFAULT_SECTION_IDS = ['crypto', 'money-owed', 'taxes'] as const;

export const OVERVIEW_SECTION_IDS = [
  'getting-started',
  ...KPI_SECTION_IDS,
  'safe-to-spend',
  'top-categories',
  'recent-transactions',
  'spend-calendar',
  'goals',
  'net-worth',
  'budgets',
  'cash-runway',
  'activity',
  'upcoming-charges',
  'advice',
  ...OFF_BY_DEFAULT_SECTION_IDS,
] as const;

export type OverviewSectionId = (typeof OVERVIEW_SECTION_IDS)[number];

export type OverviewRows = string[][];

/** What is saved per person and workspace: the rows, and the sections taken off them. */
export type OverviewLayoutState = {
  overviewRows: OverviewRows;
  hiddenSections?: string[];
};

/** Where a dragged section lands relative to the one under the pointer. */
export type DropZone = 'above' | 'below' | 'left' | 'right';

/** The grid behind a row; every width below is a span of it. */
export const GRID_COLUMNS = 12;
const ROW_UNITS = 4;
const TILE_UNITS = 1;
const CARD_UNITS = 2;

/** Before the tiles moved one by one they were a single section; saved layouts may still say so. */
const LEGACY_KPI_ROW = 'kpis';

/** The arrangement set up in the Administrator workspace, made everyone's starting point. */
export const DEFAULT_OVERVIEW_ROWS: OverviewRows = [
  ['getting-started', 'budgets'],
  [...KPI_SECTION_IDS],
  ['top-categories', 'recent-transactions'],
  ['safe-to-spend', 'cash-runway'],
  ['spend-calendar'],
  ['net-worth', 'upcoming-charges'],
  ['goals'],
  ['activity'],
  ['advice'],
];

const KNOWN = new Set<string>(OVERVIEW_SECTION_IDS);
const TILES = new Set<string>(TILE_SECTION_IDS);
const OFF_BY_DEFAULT = new Set<string>(OFF_BY_DEFAULT_SECTION_IDS);

export const isTile = (id: string): boolean => TILES.has(id);

const unitsOf = (id: string): number => (isTile(id) ? TILE_UNITS : CARD_UNITS);

const unitsIn = (ids: string[]): number => ids.reduce((sum, id) => sum + unitsOf(id), 0);

/**
 * How many of the grid's columns each section of a row spans, counting only
 * the sections that show something: a card alone takes the row, two cards
 * split it, and tiles share what the cards leave.
 */
export function rowSpans(shown: string[]): Map<string, number> {
  const cards = shown.filter(id => !isTile(id));
  const tiles = shown.filter(isTile);
  const cardSpan = cards.length === 1 && tiles.length === 0 ? GRID_COLUMNS : GRID_COLUMNS / 2;
  const left = GRID_COLUMNS - cards.length * cardSpan;
  const tileSpan = tiles.length > 0 ? left / tiles.length : 0;
  return new Map<string, number>([
    ...cards.map(id => [id, cardSpan] as const),
    ...tiles.map(id => [id, tileSpan] as const),
  ]);
}

/** Fits ids into rows by room left, in order; for whatever no longer fits where it was saved. */
function pack(ids: string[]): OverviewRows {
  const rows: OverviewRows = [];
  for (const id of ids) {
    const last = rows[rows.length - 1];
    if (last && unitsIn(last) + unitsOf(id) <= ROW_UNITS) {
      last.push(id);
    } else {
      rows.push([id]);
    }
  }
  return rows;
}

/**
 * A saved layout made safe to draw: sections that no longer exist, repeats and
 * hidden ones are dropped, the old single KPI row becomes the four tiles in its
 * place, overfull rows are cut, and sections added since the layout was saved
 * are appended, so nothing silently disappears (the setup checklist goes first
 * instead). Widgets that are off by default join only when switched on.
 */
export function normalizeRows(
  saved: { rows?: unknown; hidden?: unknown } | null | undefined,
): OverviewRows {
  if (!Array.isArray(saved?.rows)) {
    return DEFAULT_OVERVIEW_ROWS;
  }
  const hidden = Array.isArray(saved.hidden) ? saved.hidden : [];
  // Hidden sections count as placed: they are neither drawn nor appended.
  const seen = new Set<string>(hidden.filter((id): id is string => typeof id === 'string'));
  const rows: OverviewRows = [];
  const overflow: string[] = [];
  for (const row of saved.rows) {
    if (!Array.isArray(row)) {
      continue;
    }
    const entries = row.filter((id): id is string => typeof id === 'string');
    // The old KPI row had all four tiles; they keep its place as a row of their own.
    if (entries.includes(LEGACY_KPI_ROW)) {
      const tiles = KPI_SECTION_IDS.filter(id => !seen.has(id));
      for (const id of tiles) {
        seen.add(id);
      }
      if (tiles.length > 0) {
        rows.push([...tiles]);
      }
    }
    const kept: string[] = [];
    for (const id of entries) {
      if (!KNOWN.has(id) || seen.has(id)) {
        continue;
      }
      seen.add(id);
      if (unitsIn(kept) + unitsOf(id) <= ROW_UNITS) {
        kept.push(id);
      } else {
        overflow.push(id);
      }
    }
    if (kept.length > 0) {
      rows.push(kept);
    }
  }
  // The setup checklist is for newcomers, so it opens a layout saved before it
  // existed instead of hiding at the bottom; it vanishes once its job is done.
  const missing = OVERVIEW_SECTION_IDS.filter(
    id => !(seen.has(id) || OFF_BY_DEFAULT.has(id) || id === 'getting-started'),
  );
  const head = seen.has('getting-started') ? [] : [['getting-started']];
  return [...head, ...rows, ...pack([...overflow, ...missing])];
}

function rowOf(rows: OverviewRows, id: string): number {
  return rows.findIndex(row => row.includes(id));
}

/** Whether `active` may join `target`'s row: only if the row, without it, has room left for it. */
export function canSitBeside(rows: OverviewRows, active: string, target: string): boolean {
  const row = rows[rowOf(rows, target)];
  if (!row) {
    return false;
  }
  const others = row.filter(id => id !== active);
  return unitsIn(others) + unitsOf(active) <= ROW_UNITS;
}

export function moveSection(
  rows: OverviewRows,
  active: string,
  target: string,
  zone: DropZone,
): OverviewRows {
  const sideways = zone === 'left' || zone === 'right';
  if (
    active === target ||
    rowOf(rows, target) < 0 ||
    (sideways && !canSitBeside(rows, active, target))
  ) {
    return rows;
  }

  const without = rows.map(row => row.filter(id => id !== active)).filter(row => row.length > 0);
  const targetRow = rowOf(without, target);

  if (sideways) {
    return without.map((row, index) => {
      if (index !== targetRow) {
        return row;
      }
      const at = row.indexOf(target) + (zone === 'right' ? 1 : 0);
      return [...row.slice(0, at), active, ...row.slice(at)];
    });
  }

  const at = zone === 'above' ? targetRow : targetRow + 1;
  return [...without.slice(0, at), [active], ...without.slice(at)];
}

/** Takes a section off the Overview; it stays off until switched on again. */
export function hideSection(rows: OverviewRows, hidden: string[], id: string): OverviewLayoutState {
  return {
    overviewRows: rows.map(row => row.filter(each => each !== id)).filter(row => row.length > 0),
    hiddenSections: hidden.includes(id) ? hidden : [...hidden, id],
  };
}

/** Puts a section back, on a row of its own at the bottom, where it is easy to find. */
export function showSection(rows: OverviewRows, hidden: string[], id: string): OverviewLayoutState {
  return {
    overviewRows: rows.some(row => row.includes(id)) ? rows : [...rows, [id]],
    hiddenSections: hidden.filter(each => each !== id),
  };
}

export function isDefaultLayout(rows: OverviewRows): boolean {
  return JSON.stringify(rows) === JSON.stringify(DEFAULT_OVERVIEW_ROWS);
}
