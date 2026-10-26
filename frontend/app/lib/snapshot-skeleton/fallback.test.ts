import { describe, expect, it } from 'vitest';
import { fallbackSnapshot, type SkeletonFallback } from './fallback';
import { decodeSnapshot, encodeSnapshot } from './snapshot';

const KINDS: SkeletonFallback[] = ['page', 'cards', 'list', 'panel', 'lines'];

describe('fallbackSnapshot', () => {
  it.each(KINDS)('draws a valid %s sketch inside its own height', kind => {
    const snapshot = fallbackSnapshot(kind);

    // A stored snapshot must pass the same checks as one read back from storage.
    expect(decodeSnapshot(encodeSnapshot(snapshot))).toEqual(snapshot);
    for (const box of snapshot.boxes) {
      expect(box.y + box.h).toBeLessThanOrEqual(snapshot.h);
      expect(box.x + box.w).toBeLessThanOrEqual(10_000);
    }
  });
});
