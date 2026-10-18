'use client';

import { useSyncExternalStore } from 'react';
import type { TutorialStepId } from './welcome-tutorial-routes';

/**
 * Two windows share this store: the small welcome window, which opens by itself
 * for a new account, and the guide (one page per sidebar page). The guide opens
 * whole from Settings, or on a single page the first time someone visits that
 * page. At most one window is open.
 */
export type WelcomeTutorialView = 'welcome' | 'guide';

let view: WelcomeTutorialView | null = null;
/** The page the guide was opened on alone; null for the whole guide. */
let guidePage: TutorialStepId | null = null;
// The welcome window opens by itself at most once per page load, even if its host
// remounts (the workspace switch remounts part of the tree).
let autoOpenClaimed = false;
const listeners = new Set<() => void>();

function emit(next: WelcomeTutorialView | null, page: TutorialStepId | null = null): void {
  view = next;
  guidePage = page;
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

/** The guide's page about `page` alone, on a first visit to it. */
export function openGuidePage(page: TutorialStepId): void {
  emit('guide', page);
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

/** The page the guide is open on alone, or null for the whole guide (or none). */
export function useGuidePage(): TutorialStepId | null {
  return useSyncExternalStore(
    subscribe,
    () => guidePage,
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
