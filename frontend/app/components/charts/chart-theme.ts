/*
 * Chart design adapted from Aurum by ZProger (https://github.com/ZProger/Aurum).
 * Reimplemented for Seneca; no Aurum source code was copied.
 *
 * Colours are CSS variables written straight into SVG attributes, so the `.dark` theme switch
 * repaints charts without a React re-render.
 */

export const CHART_MARGIN = { top: 8, right: 4, bottom: 0, left: 4 };

export const CHART_TICK = {
  fill: 'var(--muted-foreground)',
  fontSize: 11,
  fontFamily: 'var(--font-dashboard-sans)',
};

/** A forecast is a guess: the same colours as the facts, and much fainter. */
export const FORECAST_OPACITY = 0.35;

/**
 * Income and spending bars: the sage and terracotta of the chart tones. Spending
 * is not an alarm, so neither is the bright green and red of a status.
 */
export const INCOME_FILL = 'var(--cat-tone-1)';
export const EXPENSE_FILL = 'var(--cat-tone-2)';
/** The part of spending a budget still had room for: the dusty blue, under the terracotta. */
export const BUDGETED_FILL = 'var(--cat-tone-4)';

/** The column under the pointer: a faint wash, lighter than any bar. */
export const HOVER_CURSOR = { fill: 'var(--surface-soft)' };

/** Thin horizontal guides behind bars, two or three of them. */
export const GRID_STROKE = 'var(--border)';

export const LEGEND_STYLE = {
  fontSize: 13,
  fontFamily: 'var(--font-dashboard-sans)',
  color: 'var(--text-muted)',
};

/**
 * Category colours: five muted earth tones (sage, terracotta, sand, dusty blue,
 * clay) and stone grey for the "Other" rollup — never each category's stored
 * colour, so a donut doesn't read as a rainbow. CSS variables, so dark mode
 * gets its own lighter set (`--cat-tone-*` in _globals.scss).
 */
const CATEGORY_TONES = [
  'var(--cat-tone-1)',
  'var(--cat-tone-2)',
  'var(--cat-tone-3)',
  'var(--cat-tone-4)',
  'var(--cat-tone-5)',
];
export const OTHER_TONE = 'var(--cat-tone-other)';

/** A small stable string hash (FNV-1a), the same in every browser and month. */
function stableHash(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * One tone per category, held by the category itself rather than its rank, so
 * Travel stays sage whether it is first this month or third the next. Each key
 * starts at its hash's tone; when two on the same chart land on one tone, the
 * later (in key order, not rank order) moves to the next free one. Returned in
 * the order given.
 */
/** The same tones as hex, for canvas charts (ECharts), which cannot read CSS variables. */
export const CATEGORY_TONE_HEX = {
  light: ['#6f8f7b', '#b8665a', '#d2b48c', '#7c93a8', '#a98b76'],
  dark: ['#8fb39f', '#d9806f', '#dcc39e', '#93a9bd', '#bfa18b'],
} as const;
export const OTHER_TONE_HEX = { light: '#a7ada3', dark: '#7d8279' } as const;

/** categoryTones, as hex for one theme: for charts drawn on a canvas. */
export function categoryTonesHex(
  items: Array<{ key: string; isOther?: boolean }>,
  theme: 'light' | 'dark',
): string[] {
  return toneIndexes(items).map(index =>
    index < 0 ? OTHER_TONE_HEX[theme] : CATEGORY_TONE_HEX[theme][index],
  );
}

export function categoryTones(items: Array<{ key: string; isOther?: boolean }>): string[] {
  return toneIndexes(items).map(index => (index < 0 ? OTHER_TONE : CATEGORY_TONES[index]));
}

/** Each item's tone index (−1 for the rollup), held by the key, not the rank. */
function toneIndexes(items: Array<{ key: string; isOther?: boolean }>): number[] {
  const assigned = new Map<string, number>();
  const taken = new Set<number>();
  const keyed = items
    .filter(item => !item.isOther)
    .map(item => item.key)
    .filter((key, index, all) => all.indexOf(key) === index)
    .sort();
  for (const key of keyed) {
    let tone = stableHash(key) % CATEGORY_TONES.length;
    for (let step = 0; step < CATEGORY_TONES.length && taken.has(tone); step++) {
      tone = (tone + 1) % CATEGORY_TONES.length;
    }
    taken.add(tone);
    assigned.set(key, tone);
  }
  return items.map(item => (item.isOther ? -1 : (assigned.get(item.key) ?? -1)));
}
