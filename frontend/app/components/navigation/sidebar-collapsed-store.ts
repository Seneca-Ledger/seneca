'use client';

import { useSyncExternalStore } from 'react';

/**
 * The rail/full state of the left sidebar. Outside React because the command
 * palette toggles it from a completely different part of the tree. Every load
 * starts on the rail (hovering it peeks the full sidebar); the toggle at the top
 * pins it open for the rest of the visit.
 */
let collapsed = true;
const listeners = new Set<() => void>();

function emit(next: boolean): void {
  collapsed = next;
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

export function toggleSidebarCollapsed(): void {
  emit(!collapsed);
}

export function useSidebarCollapsed(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => collapsed,
    () => true,
  );
}
