// How many rows a table had the last time it was seen, so the loading
// skeleton can draw that many rows instead of a generic block. A per-viewer
// convenience: browser storage is enough, and a miss just means a default.

import { useSyncExternalStore } from 'react';

const storageKey = (tableId: string) => `seneca:ct-row-count:${tableId}`;

/** Skeleton rows past this fill the scroll area anyway. */
export const MAX_SKELETON_ROWS = 20;
/** Used for a table this browser has never seen. */
export const DEFAULT_SKELETON_ROWS = 8;

export function readRowCount(tableId: string): number | null {
  try {
    const raw = window.localStorage.getItem(storageKey(tableId));
    const value = raw === null ? Number.NaN : Number(raw);
    return Number.isInteger(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
}

export function rememberRowCount(tableId: string, count: number): void {
  try {
    window.localStorage.setItem(storageKey(tableId), String(count));
  } catch {
    // Private mode: the next load falls back to the default.
  }
}

export function skeletonRowCount(tableId: string): number {
  return Math.min(readRowCount(tableId) ?? DEFAULT_SKELETON_ROWS, MAX_SKELETON_ROWS);
}

const noSubscribe = () => () => {
  // Nothing to unsubscribe: storage is read once per render, never watched.
};

/**
 * Skeleton row count for a table. The server render has no storage, so it
 * draws the default and the client swaps in the remembered count on hydrate
 * without a mismatch warning.
 */
export function useSkeletonRows(tableId: string): number {
  return useSyncExternalStore(
    noSubscribe,
    () => skeletonRowCount(tableId),
    () => DEFAULT_SKELETON_ROWS,
  );
}
