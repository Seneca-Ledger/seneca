// Generic skeletons for a first visit, before anything was remembered.
// They are snapshots too, so one renderer draws both. Widths are in 1/10000
// of the container width, heights in px (a text line box; the bar inside is
// drawn thinner).
import { tokens } from '@/lib/theme-tokens';
import {
  type SkeletonBox,
  type SkeletonBoxKind,
  type SkeletonSnapshot,
  WIDTH_SCALE,
} from './snapshot';

export type SkeletonFallback = 'page' | 'cards' | 'list' | 'panel' | 'lines';

const CARD_RADIUS = Number.parseInt(tokens.radius.md, 10);
const FIELD_RADIUS = Number.parseInt(tokens.radius.sm, 10);

const box = (
  k: SkeletonBoxKind,
  x: number,
  y: number,
  w: number,
  h: number,
  r = 0,
): SkeletonBox => ({
  k,
  x,
  y,
  w,
  h,
  r,
});

/** Three cards in a row, each with a caption and a figure. */
function cardRow(y: number, height: number, withChart: boolean): SkeletonBox[] {
  return [0, 3400, 6800].flatMap(x => [
    box('frame', x, y, 3200, height, CARD_RADIUS),
    box('text', x + 300, y + 20, 1400, 20),
    box('text', x + 300, y + 50, 1000, 34),
    ...(withChart ? [box('block', x + 300, y + 104, 2600, height - 128, FIELD_RADIUS)] : []),
  ]);
}

/** Rows of a list: an icon, a title with a caption, and a figure on the right. */
function listRows(y: number, count: number, inset: number): SkeletonBox[] {
  return Array.from({ length: count }, (_, index) => {
    const top = y + index * 46;
    return [
      box('circle', inset, top + 6, 400, 32, 16),
      box('text', inset + 900, top + 4, 3600, 20),
      box('text', inset + 900, top + 24, 2000, 16),
      box('text', 9600 - inset - 2000, top + 12, 2000, 20),
    ];
  }).flat();
}

/** A page's own margins: 2.5% at the sides and 24px on top, like the app's page padding. */
function withPageMargins(snapshot: SkeletonSnapshot): SkeletonSnapshot {
  const SIDE = 250;
  const scale = (WIDTH_SCALE - 2 * SIDE) / WIDTH_SCALE;
  const TOP = 24;
  return {
    h: snapshot.h + 2 * TOP,
    boxes: snapshot.boxes.map(item => ({
      ...item,
      x: SIDE + Math.round(item.x * scale),
      w: Math.round(item.w * scale),
      y: item.y + TOP,
    })),
  };
}

const FALLBACKS: Record<SkeletonFallback, SkeletonSnapshot> = {
  page: withPageMargins({
    h: 540,
    boxes: [
      box('text', 0, 0, 2200, 32),
      box('text', 0, 40, 3600, 20),
      ...cardRow(84, 120, false),
      box('frame', 0, 228, 10_000, 312, CARD_RADIUS),
      ...listRows(248, 6, 300),
    ],
  }),
  cards: { h: 220, boxes: cardRow(0, 220, true) },
  list: { h: 276, boxes: listRows(0, 6, 0) },
  panel: {
    h: 360,
    boxes: [
      box('text', 0, 0, 4000, 32),
      box('text', 0, 40, 2600, 20),
      box('block', 0, 84, 10_000, 120, CARD_RADIUS),
      box('text', 0, 228, 9000, 20),
      box('text', 0, 260, 7000, 20),
      box('text', 0, 292, 8000, 20),
      box('text', 0, 324, 5000, 20),
    ],
  },
  // A few lines inside a card or section that loads on its own.
  lines: {
    h: 96,
    boxes: [
      box('text', 0, 0, 9000, 24),
      box('text', 0, 32, 7000, 24),
      box('text', 0, 64, 5000, 24),
    ],
  },
};

export function fallbackSnapshot(kind: SkeletonFallback): SkeletonSnapshot {
  return FALLBACKS[kind];
}
