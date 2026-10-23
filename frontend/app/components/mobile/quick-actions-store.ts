'use client';

import type React from 'react';
import { useEffect, useRef, useSyncExternalStore } from 'react';

/**
 * Actions a page puts under the mobile "+" while it is mounted, in place of the
 * page's own header button (hidden on a phone). Without any, the "+" offers the
 * default upload/scan/expense set.
 */
export interface QuickAction {
  id: string;
  /** Already localized. */
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  run: () => void;
}

let actions: QuickAction[] | null = null;
const listeners = new Set<() => void>();

function emit(next: QuickAction[] | null): void {
  actions = next;
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

export function usePageQuickActions(): QuickAction[] | null {
  return useSyncExternalStore(
    subscribe,
    () => actions,
    () => null,
  );
}

/**
 * Registers the page's actions for as long as the caller stays mounted. Like
 * `usePageCommands`, the bar hears about a change only when the rows change,
 * and each row runs the caller's latest handler.
 */
export function useQuickActions(next: QuickAction[] | null): void {
  const latest = useRef(next);
  useEffect(() => {
    latest.current = next;
  });
  const signature = next ? JSON.stringify(next.map(action => [action.id, action.label])) : '';
  // biome-ignore lint/correctness/useExhaustiveDependencies: signature is the trigger
  useEffect(() => {
    const current = latest.current;
    emit(
      current
        ? current.map(action => ({
            ...action,
            run: () => latest.current?.find(item => item.id === action.id)?.run(),
          }))
        : null,
    );
  }, [signature]);
  useEffect(() => () => emit(null), []);
}
