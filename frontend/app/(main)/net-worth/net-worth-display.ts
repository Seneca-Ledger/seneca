'use client';

import { useSyncExternalStore } from 'react';

/**
 * How the chart is drawn, as this viewer likes it. A per-viewer convenience,
 * so browser storage is enough and a miss just means the default.
 *
 * Both are off by default, and both deliberately. An axis that starts at zero
 * is the honest picture but costs most of the height, so it is offered rather
 * than imposed. The all-time high is the same argument the other way round: a
 * portfolio that mostly grows has its high today, and being shown how far
 * below a peak you are is a thing people ask to be able to turn off.
 */
export interface NetWorthDisplay {
  zeroBaseline: boolean;
  allTimeHigh: boolean;
}

const STORAGE_KEY = 'lumio:net-worth-display';
const DEFAULTS: NetWorthDisplay = { zeroBaseline: false, allTimeHigh: false };

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let snapshot: NetWorthDisplay = DEFAULTS;

function parse(raw: string | null): NetWorthDisplay {
  try {
    const parsed = raw ? (JSON.parse(raw) as Partial<NetWorthDisplay>) : {};
    return {
      zeroBaseline: parsed.zeroBaseline === true,
      allTimeHigh: parsed.allTimeHigh === true,
    };
  } catch {
    // Something else wrote nonsense under the key.
    return DEFAULTS;
  }
}

/**
 * Re-reads storage but keeps the same object while the stored text has not
 * changed: `useSyncExternalStore` compares snapshots by identity, and a new
 * object every render would loop forever. Re-reading also means a choice made
 * in another tab is picked up on the next render.
 */
function read(): NetWorthDisplay {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private mode: what this page already has is as good as it gets.
    return snapshot;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    snapshot = parse(raw);
  }
  return snapshot;
}

export function setNetWorthDisplay(patch: Partial<NetWorthDisplay>): void {
  snapshot = { ...read(), ...patch };
  cachedRaw = JSON.stringify(snapshot);
  try {
    window.localStorage.setItem(STORAGE_KEY, cachedRaw);
  } catch {
    // Not being able to remember it is no reason not to apply it.
  }
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The server render has no storage, so it draws the defaults and the client
 * swaps the stored choice in on hydrate without a mismatch.
 */
export function useNetWorthDisplay(): NetWorthDisplay {
  return useSyncExternalStore(subscribe, read, () => DEFAULTS);
}
