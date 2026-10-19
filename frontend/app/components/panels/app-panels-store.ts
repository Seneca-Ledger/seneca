'use client';

import { useSyncExternalStore } from 'react';

export type AppPanelKey = 'integrations' | 'plugins' | 'notifications' | 'whatsNew';

export type AppPanelState = {
  /** The list drawer (first layer) that is open, if any. */
  panel: AppPanelKey | null;
  /** The entry opened in the settings drawer (second layer), if any. */
  item: string | null;
};

const CLOSED: AppPanelState = { panel: null, item: null };

/**
 * Panel state lives outside React so that any entry point — the account menu, a
 * side panel, a redirect stub — can open a panel by calling a function, with
 * no provider to thread through the tree.
 */
let state: AppPanelState = CLOSED;
const listeners = new Set<() => void>();

function emit(next: AppPanelState): void {
  state = next;
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

function getSnapshot(): AppPanelState {
  return state;
}

function getServerSnapshot(): AppPanelState {
  return CLOSED;
}

/** Opens a list drawer, optionally straight on one entry's settings. */
export function openAppPanel(panel: AppPanelKey, item?: string): void {
  emit({ panel, item: item ?? null });
}

/** Opens one entry's settings on top of the list drawer. */
export function openAppPanelItem(item: string): void {
  emit({ ...state, item });
}

/** Closes the settings drawer and leaves the list open. */
export function closeAppPanelItem(): void {
  emit({ ...state, item: null });
}

export function closeAppPanel(): void {
  emit(CLOSED);
}

export function useAppPanelState(): AppPanelState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
