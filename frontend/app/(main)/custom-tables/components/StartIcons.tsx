import type { SourceKind } from '../sources';
import type { TableTemplateId } from '../templates';

/**
 * The blank card keeps its plain grid of tables, a filled drawing on its own
 * square viewBox.
 */
const BLANK = {
  viewBox: '-7.01 -7.04 114.07 114.07',
  paths: [
    'M35.5 77.7H63.3V97.5H35.5Z',
    'M35.5 52.6H63.3V72.4H35.5Z',
    'M2.5 52.6H30.3V72.4H2.5Z',
    'M2.5 27.6H30.3V47.4H2.5Z',
    'M68.5 27.6H97.5V47.4H68.5Z',
    'M35.5 27.6H63.3V47.4H35.5Z',
    'M68.5 52.6H97.5V72.4H68.5Z',
    'M2.5,92.7c0,2.7,2.2,4.8,4.8,4.8h23V77.7H2.5V92.7z',
    'M92.7,2.5H7.3c-2.7,0-4.8,2.2-4.8,4.8v15h95v-15C97.5,4.7,95.3,2.5,92.7,2.5z',
    'M68.5,97.5h24.2c2.7,0,4.8-2.2,4.8-4.8v-15h-29V97.5z',
  ],
};

/**
 * Every other card is a line icon — 1.5px strokes with round ends, no fills —
 * like the icons on the rest of the quiet screens.
 */
const LINES = {
  // Two arrows passing each other: money in and out.
  transactions: ['M4 8h15l-3.5-3.5', 'M20 16H5l3.5 3.5'],
  // A month with a circling arrow: something that repeats.
  subscriptions: [
    'M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v11.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5z',
    'M3.5 9.5h17',
    'M8 3.5v4M16 3.5v4',
    'M14.6 15.2a2.6 2.6 0 1 1-.7-2.4M14.1 11.4v1.6h-1.6',
  ],
  // A funnel: deals narrowing to the ones that close.
  pipeline: ['M4 5h16l-6 7.5V19l-4-2v-4.5z'],
  // A bill with an arrow out: what is still to be paid.
  payables: [
    'M14 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h5',
    'M14 3.5l4.5 4.5v5',
    'M9 9h4M9 12.5h5',
    'M15 18h6m-2.5-2.5L21 18l-2.5 2.5',
  ],
  // A page with lines: an invoice.
  invoices: [
    'M14 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z',
    'M14 3.5V8h4.5',
    'M9 12h6M9 15.5h4',
  ],
  // A pie with a slice taken out: planned against spent.
  budget: ['M11 4.5a8 8 0 1 0 8 8h-8z', 'M14 2.5v7h7a7 7 0 0 0-7-7z'],
} as const;

type LineName = keyof typeof LINES;

const TEMPLATE_GLYPHS: Record<TableTemplateId, LineName> = {
  invoices: 'invoices',
  payables: 'payables',
  budget: 'budget',
  pipeline: 'pipeline',
  subscriptions: 'subscriptions',
};

const SOURCE_GLYPHS: Record<SourceKind, LineName> = {
  transactions: 'transactions',
  subscriptions: 'subscriptions',
  payables: 'payables',
  invoices: 'invoices',
  budgets: 'budget',
};

function LineIcon({ name }: { name: LineName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {LINES[name].map(d => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

function BlankIcon() {
  return (
    <svg viewBox={BLANK.viewBox} fill="currentColor" aria-hidden="true" focusable="false">
      {BLANK.paths.map(d => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** Template card glyph; the blank card gets the plain grid of tables. */
export function TemplateIcon({ id }: { id: TableTemplateId | null }) {
  return id ? <LineIcon name={TEMPLATE_GLYPHS[id]} /> : <BlankIcon />;
}

export function SourceIcon({ id }: { id: SourceKind }) {
  return <LineIcon name={SOURCE_GLYPHS[id]} />;
}
