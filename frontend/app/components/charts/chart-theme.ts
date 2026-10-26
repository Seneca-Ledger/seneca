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

/** Twelve calm tones for merchants (`--merchant-tone-*` in _globals.scss). */
const MERCHANT_TONE_COUNT = 12;
/**
 * The hue family of each merchant tone, in token order: green (sage, pine,
 * eucalyptus, moss), warm red (terracotta, dusty rose, clay), blue (dusty
 * blue, slate, lavender grey), yellow (sand, soft ochre).
 */
const MERCHANT_TONE_FAMILY = [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 0];

/**
 * One tone per merchant on a chart. The first name keeps its own tone (held by
 * the name, so a payee's bars and its line match); each next one keeps its own
 * too while that hue family is still free on the chart, and otherwise moves to
 * the nearest tone of a free family, so up to four lines never share a family
 * and up to twelve never share a tone. Past twelve a tone repeats.
 */
export function merchantTones(names: string[]): string[] {
  const taken = new Set<number>();
  const families = new Set<number>();
  const assigned = new Map<string, number>();
  for (const name of names) {
    if (assigned.has(name)) {
      continue;
    }
    const own = stableHash(name) % MERCHANT_TONE_COUNT;
    const free = (tone: number, wholeFamily: boolean) =>
      !(taken.has(tone) || (wholeFamily && families.has(MERCHANT_TONE_FAMILY[tone])));
    const steps = Array.from(
      { length: MERCHANT_TONE_COUNT },
      (_, step) => (own + step) % MERCHANT_TONE_COUNT,
    );
    const tone =
      steps.find(candidate => free(candidate, families.size < 4)) ??
      steps.find(candidate => free(candidate, false)) ??
      own;
    taken.add(tone);
    families.add(MERCHANT_TONE_FAMILY[tone]);
    assigned.set(name, tone);
  }
  return names.map(name => `var(--merchant-tone-${(assigned.get(name) ?? 0) + 1})`);
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
