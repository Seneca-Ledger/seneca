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
 * wraps at both ends. It resets whenever the rows change — a debounced search
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

  // A new rows array is exactly the signal to reset: the cursor must not survive
  // a landing search and point past the end.
  // biome-ignore lint/correctness/useExhaustiveDependencies: rows is the trigger
  useEffect(() => {
    setActiveIndex(0);
  }, [rows]);

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
