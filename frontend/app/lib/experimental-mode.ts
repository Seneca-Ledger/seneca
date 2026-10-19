'use client';

/**
 * Experimental mode: unfinished features stay hidden until the user opts in
 * from Settings → Experimental. Stored in localStorage — it is a per-device
 * UI preference, not user data.
 */
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'lumio-experimental-mode';

export const EXPERIMENTAL_MODE_EVENT = 'lumio-experimental-mode-change';

export function isExperimentalModeEnabled(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

export function setExperimentalModeEnabled(on: boolean): void {
  try {
    if (on) {
      window.localStorage.setItem(STORAGE_KEY, 'on');
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage may be unavailable (private mode); the preference just won't stick.
  }
  window.dispatchEvent(new CustomEvent(EXPERIMENTAL_MODE_EVENT, { detail: { enabled: on } }));
}

/**
 * Reads the flag after mount (never during SSR) and re-renders when it is
 * toggled, in this tab or another one.
 */
export function useExperimentalMode(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const sync = (): void => {
      setEnabled(isExperimentalModeEnabled());
    };
    sync();
    window.addEventListener(EXPERIMENTAL_MODE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EXPERIMENTAL_MODE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return enabled;
}
