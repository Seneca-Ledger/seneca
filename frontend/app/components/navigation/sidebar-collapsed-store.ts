'use client';

import { useSyncExternalStore } from 'react';
import {
  parseSidebarCollapsedCookie,
  SIDEBAR_COLLAPSED_COOKIE,
} from '@/app/lib/sidebar-preference';

/**
 * The rail/full state of the left sidebar. Outside React because the command
 * palette toggles it from a completely different part of the tree. The pin
 * button beside the sidebar fixes it in either state, and the cookie carries the
 * choice over to the next visit (the server reads it to render the same width).
 */
let collapsed: boolean | null = null;
const listeners = new Set<() => void>();

function readCookie(): boolean {
  const entry = document.cookie
    .split('; ')
    .find(part => part.startsWith(`${SIDEBAR_COLLAPSED_COOKIE}=`));
  return parseSidebarCollapsedCookie(entry?.slice(SIDEBAR_COLLAPSED_COOKIE.length + 1));
}

function current(): boolean {
  collapsed ??= readCookie();
  return collapsed;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function toggleSidebarCollapsed(): void {
  collapsed = !current();
  document.cookie = `${SIDEBAR_COLLAPSED_COOKIE}=${collapsed ? '1' : '0'}; path=/; max-age=31536000; samesite=lax`;
  for (const listener of listeners) {
    listener();
  }
}

/** `initial` is the cookie as the server read it, so hydration renders the same width. */
export function useSidebarCollapsed(initial = false): boolean {
  return useSyncExternalStore(subscribe, current, () => initial);
}
