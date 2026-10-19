'use client';

import { useSyncExternalStore } from 'react';

/**
 * Open state lives outside React, like the app panels, so the sidebar button and
 * the global Mod+K binding can both reach the palette with a function call.
 */
let open = false;
const listeners = new Set<() => void>();

function emit(next: boolean): void {
  open = next;
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

export function openCommandPalette(): void {
  emit(true);
}

export function closeCommandPalette(): void {
  emit(false);
}

export function toggleCommandPalette(): void {
  emit(!open);
}

export function useCommandPaletteOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );
}
