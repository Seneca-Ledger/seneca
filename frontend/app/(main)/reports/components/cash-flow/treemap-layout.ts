/**
 * Squarified treemap layout (Bruls, Huizing, van Wijk): rows of tiles whose
 * aspect ratios stay as close to 1 as the order allows. Pure, so the tiles
 * can be asserted without rendering.
 */

export interface TreemapItem {
  id: string;
  value: number;
}

export interface TreemapTile {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function layoutTreemap(items: TreemapItem[], width: number, height: number): TreemapTile[] {
  const sorted = items.filter(item => item.value > 0).sort((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, item) => sum + item.value, 0);
  if (sorted.length === 0 || total <= 0 || width <= 0 || height <= 0) return [];
  const area = width * height;
  const scaled = sorted.map(item => ({ id: item.id, area: (item.value / total) * area }));

  const tiles: TreemapTile[] = [];
  let x = 0;
  let y = 0;
  let w = width;
  let h = height;
  let row: Array<{ id: string; area: number }> = [];

  const worst = (candidates: Array<{ area: number }>, side: number): number => {
    const sum = candidates.reduce((s, c) => s + c.area, 0);
    const max = Math.max(...candidates.map(c => c.area));
    const min = Math.min(...candidates.map(c => c.area));
    return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
  };

  const flush = () => {
    const sum = row.reduce((s, c) => s + c.area, 0);
    const horizontal = w >= h; // lay the row along the shorter side
    if (horizontal) {
      const rowWidth = sum / h;
      let cursor = y;
      for (const item of row) {
        const tileHeight = item.area / rowWidth;
        tiles.push({ id: item.id, x, y: cursor, width: rowWidth, height: tileHeight });
        cursor += tileHeight;
      }
      x += rowWidth;
      w -= rowWidth;
    } else {
      const rowHeight = sum / w;
      let cursor = x;
      for (const item of row) {
        const tileWidth = item.area / rowHeight;
        tiles.push({ id: item.id, x: cursor, y, width: tileWidth, height: rowHeight });
        cursor += tileWidth;
      }
      y += rowHeight;
      h -= rowHeight;
    }
    row = [];
  };

  for (const item of scaled) {
    const side = Math.min(w, h);
    if (row.length === 0 || worst([...row, item], side) <= worst(row, side)) {
      row.push(item);
    } else {
      flush();
      row.push(item);
    }
  }
  if (row.length > 0) flush();
  return tiles.map(tile => ({
    ...tile,
    x: round(tile.x),
    y: round(tile.y),
    width: round(tile.width),
    height: round(tile.height),
  }));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
