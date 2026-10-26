'use client';

/**
 * Receipts shot with the camera while the phone had no GPS fix (usually
 * indoors), waiting to ask "which shop was this?" once the fix comes back.
 * Kept on the device on purpose: only this phone can tell where it was after
 * leaving the shop, and asking on a laptop would suggest shops near the laptop.
 * The queue holds no coordinates.
 */
import { useEffect, useState } from 'react';

const PROMPT_KEY = 'seneca-receipt-place-prompt';
const QUEUE_KEY = 'seneca-receipt-place-pending';

export const RECEIPT_PLACE_FOLLOWUP_EVENT = 'seneca-receipt-place-followup-change';

/** Past this the phone has moved on, and places around it say nothing about the shop. */
export const FOLLOWUP_TTL_MS = 2 * 60 * 60 * 1000;
/** While the app stays open, GPS is watched this long after the shot. */
export const FOLLOWUP_WATCH_MS = 20 * 60 * 1000;
/**
 * A fix at least this precise counts as "GPS is back". A rougher one (Wi-Fi or
 * cell towers indoors) is still sent with the upload, but the shop is asked.
 */
export const GOOD_FIX_ACCURACY_M = 100;
const MAX_ENTRIES = 10;

export type PendingPlaceFollowup = {
  statementId: string;
  workspaceId: string;
  capturedAt: number;
};

const notify = (): void => {
  window.dispatchEvent(new CustomEvent(RECEIPT_PLACE_FOLLOWUP_EVENT));
};

const readJson = (key: string): unknown => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
};

const isEntry = (value: unknown): value is PendingPlaceFollowup => {
  const entry = value as Partial<PendingPlaceFollowup> | null;
  return (
    typeof entry?.statementId === 'string' &&
    typeof entry.workspaceId === 'string' &&
    typeof entry.capturedAt === 'number'
  );
};

const writeQueue = (entries: PendingPlaceFollowup[]): void => {
  try {
    if (entries.length === 0) {
      window.localStorage.removeItem(QUEUE_KEY);
    } else {
      window.localStorage.setItem(QUEUE_KEY, JSON.stringify(entries));
    }
  } catch {
    // Without storage the question is simply never asked.
  }
  notify();
};

/** Is asking allowed on this device? On unless the user chose "Don't show again". */
export function getReceiptPlacePrompt(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return window.localStorage.getItem(PROMPT_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setReceiptPlacePrompt(on: boolean): void {
  try {
    window.localStorage.setItem(PROMPT_KEY, on ? 'on' : 'off');
  } catch {
    // Storage may be unavailable (private mode).
  }
  if (!on) {
    writeQueue([]);
    return;
  }
  notify();
}

/** Newest first, expired entries dropped. */
export function listPlaceFollowups(now = Date.now()): PendingPlaceFollowup[] {
  if (typeof window === 'undefined') {
    return [];
  }
  const stored = readJson(QUEUE_KEY);
  if (!Array.isArray(stored)) {
    return [];
  }
  return stored
    .filter(isEntry)
    .filter(entry => now - entry.capturedAt < FOLLOWUP_TTL_MS && entry.capturedAt <= now)
    .sort((a, b) => b.capturedAt - a.capturedAt);
}

export function enqueuePlaceFollowups(entries: PendingPlaceFollowup[]): void {
  if (entries.length === 0 || !getReceiptPlacePrompt()) {
    return;
  }
  const fresh = new Set(entries.map(entry => entry.statementId));
  const kept = listPlaceFollowups().filter(entry => !fresh.has(entry.statementId));
  writeQueue(
    [...entries, ...kept].sort((a, b) => b.capturedAt - a.capturedAt).slice(0, MAX_ENTRIES),
  );
}

export function removePlaceFollowup(statementId: string): void {
  writeQueue(listPlaceFollowups().filter(entry => entry.statementId !== statementId));
}

/** The camera had no usable fix, so the shop is worth asking about later. */
export function needsPlaceFollowup(location: { accuracy: number } | null): boolean {
  return location === null || !(location.accuracy <= GOOD_FIX_ACCURACY_M);
}

/** Follows the prompt flag and the queue from this tab or another one. */
export function useReceiptPlaceFollowups(): {
  promptOn: boolean;
  pending: PendingPlaceFollowup[];
} {
  const [state, setState] = useState<{ promptOn: boolean; pending: PendingPlaceFollowup[] }>({
    promptOn: false,
    pending: [],
  });

  useEffect(() => {
    const sync = (): void => {
      setState({ promptOn: getReceiptPlacePrompt(), pending: listPlaceFollowups() });
    };
    sync();
    window.addEventListener(RECEIPT_PLACE_FOLLOWUP_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(RECEIPT_PLACE_FOLLOWUP_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return state;
}
