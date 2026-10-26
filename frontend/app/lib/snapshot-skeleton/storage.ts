// Remembered skeletons live in localStorage, one entry per block and width
// bucket. An index of last use and size keeps them within a small budget:
// the least recently used ones go first. Storage may be missing, full or
// blocked (private windows), so every access is guarded and failure only
// means the generic skeleton shows.
import { decodeSnapshot, encodeSnapshot, type SkeletonSnapshot, widthBucket } from './snapshot';

const PREFIX = 'seneca:skeleton:v1:';
const INDEX_KEY = `${PREFIX}index`;
/** Characters of snapshot JSON kept in total (~200 KB). */
export const STORAGE_BUDGET = 200_000;

/** key → [last used, size in characters] */
type Index = Record<string, [number, number]>;

interface Options {
  budget?: number;
  now?: () => number;
}

const storageKey = (id: string, width: number) => `${PREFIX}${id}:${widthBucket(width)}`;

function getStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function readIndex(storage: Storage): Index {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(INDEX_KEY) ?? '{}');
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Index)
      : {};
  } catch {
    return {};
  }
}

function saveIndex(storage: Storage, index: Index): void {
  try {
    storage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    // Without an index the entries stay readable; the next write retries.
  }
}

export function readSnapshot(
  id: string,
  width: number,
  { now = Date.now }: Options = {},
): SkeletonSnapshot | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }
  const key = storageKey(id, width);
  try {
    const snapshot = decodeSnapshot(storage.getItem(key));
    if (!snapshot) {
      return null;
    }
    const index = readIndex(storage);
    if (index[key]) {
      index[key] = [now(), index[key][1]];
      saveIndex(storage, index);
    }
    return snapshot;
  } catch {
    return null;
  }
}

function evict(storage: Storage, index: Index, room: number, budget: number): void {
  let total = Object.values(index).reduce((sum, [, size]) => sum + size, 0);
  const oldestFirst = Object.entries(index).sort(([, a], [, b]) => a[0] - b[0]);
  for (const [key, [, size]] of oldestFirst) {
    if (total + room <= budget) {
      break;
    }
    storage.removeItem(key);
    delete index[key];
    total -= size;
  }
}

export function writeSnapshot(
  id: string,
  width: number,
  snapshot: SkeletonSnapshot,
  { budget = STORAGE_BUDGET, now = Date.now }: Options = {},
): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  const key = storageKey(id, width);
  const value = encodeSnapshot(snapshot);
  if (value.length > budget) {
    return;
  }
  try {
    const index = readIndex(storage);
    delete index[key];
    storage.removeItem(key);
    evict(storage, index, value.length, budget);
    storage.setItem(key, value);
    index[key] = [now(), value.length];
    saveIndex(storage, index);
  } catch {
    // Quota or a blocked storage: the generic skeleton keeps working.
  }
}
