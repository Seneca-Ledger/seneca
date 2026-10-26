'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PaletteRow } from './use-palette-sections';

/** Where each navigation key moves the cursor, given the current one. */
const MOVES: Record<string, (index: number, count: number) => number> = {
  ArrowDown: (index, count) => (index + 1) % count,
  ArrowUp: (index, count) => (index - 1 + count) % count,
  Home: () => 0,
  End: (_index, count) => count - 1,
};

/**
 * The flat row list is one index space, so the cursor is a plain number that
 * wraps at both ends. It resets whenever the set of rows changes — a debounced search
 * landing must not leave it pointing past the end.
 */
export function usePaletteKeyboard(
  rows: PaletteRow[],
  onRun: (row: PaletteRow) => void,
  onClose: () => void,
): {
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
} {
  const [activeIndex, setActiveIndex] = useState(0);

  // Keyed on the row ids, not the array: a re-render that rebuilds the same rows
  // must not throw the cursor back to the top under the arrow keys or the pointer.
  const rowIds = rows.map(row => row.id).join('\n');
  // biome-ignore lint/correctness/useExhaustiveDependencies: rowIds is the trigger
  useEffect(() => {
    setActiveIndex(0);
  }, [rowIds]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (rows.length === 0) {
        return;
      }

      const move = MOVES[event.key];
      if (move) {
        event.preventDefault();
        setActiveIndex(index => move(index, rows.length));
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        const row = rows[Math.min(activeIndex, rows.length - 1)];
        if (row) {
          onRun(row);
        }
      }
    },
    [rows, activeIndex, onRun, onClose],
  );

  return { activeIndex, setActiveIndex, onKeyDown };
}
