/**
 * The Overview tab as rows of sections. A row holds one section, which spans
 * the full width, or two, which split it in half — so moving a section next to
 * another is what makes both of them narrower, and moving it out is what lets
 * the one left behind grow back.
 */

export const OVERVIEW_SECTION_IDS = [
  'kpis',
  'crypto',
  'top-categories',
  'recent-transactions',
  'spend-calendar',
  'goals',
  'net-worth',
  'budgets',
  'cash-runway',
  'activity',
] as const;

export type OverviewSectionId = (typeof OVERVIEW_SECTION_IDS)[number];

export type OverviewRows = string[][];

/** Where a dragged section lands relative to the one under the pointer. */
export type DropZone = 'above' | 'below' | 'left' | 'right';

const MAX_PER_ROW = 2;

export const DEFAULT_OVERVIEW_ROWS: OverviewRows = [
  ['kpis'],
  ['crypto'],
  ['top-categories', 'recent-transactions'],
  ['spend-calendar'],
  ['goals'],
  ['net-worth'],
  ['budgets', 'cash-runway'],
  ['activity'],
];

const KNOWN = new Set<string>(OVERVIEW_SECTION_IDS);

/**
 * A saved layout made safe to draw: sections that no longer exist and repeats
 * are dropped, overfull rows are cut, and sections added since the layout was
 * saved are appended, each on its own row, so nothing silently disappears.
 */
export function normalizeRows(saved: { rows?: unknown } | null | undefined): OverviewRows {
  if (!Array.isArray(saved?.rows)) {
    return DEFAULT_OVERVIEW_ROWS;
  }
  const seen = new Set<string>();
  const rows: OverviewRows = [];
  const overflow: string[] = [];
  for (const row of saved.rows) {
    if (!Array.isArray(row)) {
      continue;
    }
    const ids = row.filter(
      (id): id is string => typeof id === 'string' && KNOWN.has(id) && !seen.has(id),
    );
    for (const id of ids) {
      seen.add(id);
    }
    if (ids.length > 0) {
      rows.push(ids.slice(0, MAX_PER_ROW));
      overflow.push(...ids.slice(MAX_PER_ROW));
    }
  }
  const missing = OVERVIEW_SECTION_IDS.filter(id => !seen.has(id));
  return [...rows, ...[...overflow, ...missing].map(id => [id])];
}

function rowOf(rows: OverviewRows, id: string): number {
  return rows.findIndex(row => row.includes(id));
}

/** Whether `active` may join `target`'s row: only a lone section or its own partner has room. */
export function canSitBeside(rows: OverviewRows, active: string, target: string): boolean {
  const row = rows[rowOf(rows, target)];
  return Boolean(row) && (row.length < MAX_PER_ROW || row.includes(active));
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
      return zone === 'left' ? [active, ...row] : [...row, active];
    });
  }

  const at = zone === 'above' ? targetRow : targetRow + 1;
  return [...without.slice(0, at), [active], ...without.slice(at)];
}

export function isDefaultLayout(rows: OverviewRows): boolean {
  return JSON.stringify(rows) === JSON.stringify(DEFAULT_OVERVIEW_ROWS);
}
