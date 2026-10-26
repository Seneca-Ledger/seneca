// The shape of a remembered skeleton: where the visual pieces of a block sat
// the last time it rendered with data. Geometry only — no text, numbers, URLs,
// class names or colours ever leave the page through it.

export type SkeletonBoxKind = 'text' | 'block' | 'circle' | 'frame';

/** One piece. `x` and `w` are shares of the container width in 1/10000; `y`, `h`, `r` are px. */
export interface SkeletonBox {
  k: SkeletonBoxKind;
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}

export interface SkeletonSnapshot {
  /** Container height in px. */
  h: number;
  boxes: SkeletonBox[];
}

/** Width shares are stored in 1/10000 of the container width. */
export const WIDTH_SCALE = 10_000;
export const MAX_BOXES = 300;
const MAX_HEIGHT = 10_000;

const KINDS: readonly SkeletonBoxKind[] = ['text', 'block', 'circle', 'frame'];
const WIDTH_BUCKETS: ReadonlyArray<readonly [number, string]> = [
  [480, 'xs'],
  [768, 'sm'],
  [1024, 'md'],
  [1440, 'lg'],
];

/** Phone, tablet and desktop layouts of the same block are remembered apart. */
export function widthBucket(width: number): string {
  for (const [limit, name] of WIDTH_BUCKETS) {
    if (width < limit) {
      return name;
    }
  }
  return 'xl';
}

/** Compact JSON: `{ h, b: [[kind, x, y, w, h, r], …] }`. */
export function encodeSnapshot(snapshot: SkeletonSnapshot): string {
  return JSON.stringify({
    h: snapshot.h,
    b: snapshot.boxes.map(box => [KINDS.indexOf(box.k), box.x, box.y, box.w, box.h, box.r]),
  });
}

const isInt = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

function decodeBox(raw: unknown): SkeletonBox | null {
  if (!Array.isArray(raw) || raw.length !== 6) {
    return null;
  }
  const [kind, x, y, w, h, r] = raw;
  if (!isInt(kind, 0, KINDS.length - 1)) {
    return null;
  }
  if (!(isInt(x, 0, WIDTH_SCALE) && isInt(w, 1, WIDTH_SCALE))) {
    return null;
  }
  if (!(isInt(y, 0, MAX_HEIGHT) && isInt(h, 1, MAX_HEIGHT) && isInt(r, 0, MAX_HEIGHT))) {
    return null;
  }
  return { k: KINDS[kind], x, y, w, h, r };
}

/** Reads what localStorage gave back; anything malformed counts as no snapshot. */
export function decodeSnapshot(text: string | null): SkeletonSnapshot | null {
  if (!text) {
    return null;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const { h, b } = raw as { h?: unknown; b?: unknown };
  if (!(isInt(h, 1, MAX_HEIGHT) && Array.isArray(b)) || b.length === 0 || b.length > MAX_BOXES) {
    return null;
  }
  const boxes: SkeletonBox[] = [];
  for (const item of b) {
    const box = decodeBox(item);
    if (!box) {
      return null;
    }
    boxes.push(box);
  }
  return { h, boxes };
}
