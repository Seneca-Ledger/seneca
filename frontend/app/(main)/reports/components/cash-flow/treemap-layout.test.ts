import { describe, expect, it } from 'vitest';
import { layoutTreemap } from './treemap-layout';

describe('layoutTreemap', () => {
  it('fills the box exactly and gives bigger values bigger tiles', () => {
    const tiles = layoutTreemap(
      [
        { id: 'a', value: 6 },
        { id: 'b', value: 6 },
        { id: 'c', value: 4 },
        { id: 'd', value: 3 },
        { id: 'e', value: 2 },
        { id: 'f', value: 2 },
        { id: 'g', value: 1 },
      ],
      600,
      400,
    );
    const area = tiles.reduce((sum, tile) => sum + tile.width * tile.height, 0);
    expect(Math.round(area)).toBe(240000);
    const byId = Object.fromEntries(tiles.map(tile => [tile.id, tile.width * tile.height]));
    expect(byId.a).toBeGreaterThan(byId.c);
    expect(byId.c).toBeGreaterThan(byId.g);
    for (const tile of tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(0);
      expect(tile.y).toBeGreaterThanOrEqual(0);
      expect(tile.x + tile.width).toBeLessThanOrEqual(600.01);
      expect(tile.y + tile.height).toBeLessThanOrEqual(400.01);
    }
  });

  it('keeps tiles squarish rather than long slivers', () => {
    const tiles = layoutTreemap(
      Array.from({ length: 6 }, (_, index) => ({ id: String(index), value: 10 })),
      300,
      200,
    );
    for (const tile of tiles) {
      const ratio = Math.max(tile.width / tile.height, tile.height / tile.width);
      expect(ratio).toBeLessThan(3);
    }
  });

  it('ignores zero and negative values and empty boxes', () => {
    expect(layoutTreemap([{ id: 'a', value: 0 }], 100, 100)).toEqual([]);
    expect(layoutTreemap([{ id: 'a', value: 5 }], 0, 100)).toEqual([]);
    expect(layoutTreemap([{ id: 'a', value: 5 }], 100, 100)).toEqual([
      { id: 'a', x: 0, y: 0, width: 100, height: 100 },
    ]);
  });
});
