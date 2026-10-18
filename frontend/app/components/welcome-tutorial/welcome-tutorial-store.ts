'use client';

import { useSyncExternalStore } from 'react';

/**
 * Two windows share this store: the small welcome window, which opens by itself
 * for a new account, and the guide (the tour of every page), which opens only
 * when the person asks for it. At most one is open.
 */
export type WelcomeTutorialView = 'welcome' | 'guide';

let view: WelcomeTutorialView | null = null;
// The welcome window opens by itself at most once per page load, even if its host
// remounts (the workspace switch remounts part of the tree).
let autoOpenClaimed = false;
const listeners = new Set<() => void>();

function emit(next: WelcomeTutorialView | null): void {
  view = next;
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

/** The welcome window: what a new account sees first. */
export function openWelcome(): void {
  emit('welcome');
}

/** The guide, from Settings. */
export function openGuide(): void {
  emit('guide');
}

/** The name the Settings link has always called; it opens the guide. */
export const openWelcomeTutorial = openGuide;

/** Closes whichever is open. */
export function closeWelcomeTutorial(): void {
  emit(null);
}

export function useWelcomeTutorialView(): WelcomeTutorialView | null {
  return useSyncExternalStore(
    subscribe,
    () => view,
    () => null,
  );
}

/** True the first time only. */
export function claimAutoOpen(): boolean {
  if (autoOpenClaimed) {
    return false;
  }
  autoOpenClaimed = true;
  return true;
}
