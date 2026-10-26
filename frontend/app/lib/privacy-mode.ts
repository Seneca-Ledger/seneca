'use client';

import { useSyncExternalStore } from 'react';
import { PRIVACY_STORAGE_KEY } from './privacy-mode-boot';

/**
 * Privacy mode: every amount is drawn as a pencil scribble and shows only under
 * the pointer, for showing the screen to someone. A setting of this device, not
 * of the account: switched on for a screen share on a laptop, it leaves the
 * phone alone.
 *
 * The switch is `<html data-privacy="on">`; `.seneca-private` text takes the
 * redaction font under it (styles/base/_privacy.scss). An inline script in the
 * root layout (`PRIVACY_BOOT_SCRIPT`, privacy-mode-boot.ts) sets the attribute before the first paint,
 * so a reload never flashes the real figures.
 */

const PRIVACY_EVENT = 'seneca-privacy-mode';

function readStored(): boolean {
  try {
    return window.localStorage.getItem(PRIVACY_STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

function applyToDocument(on: boolean): void {
  if (on) {
    document.documentElement.dataset.privacy = 'on';
  } else {
    delete document.documentElement.dataset.privacy;
  }
}

export function setPrivacyMode(on: boolean): void {
  try {
    if (on) {
      window.localStorage.setItem(PRIVACY_STORAGE_KEY, 'on');
    } else {
      window.localStorage.removeItem(PRIVACY_STORAGE_KEY);
    }
  } catch {
    // Private browsing without storage: the mode still holds for this page.
  }
  applyToDocument(on);
  window.dispatchEvent(new Event(PRIVACY_EVENT));
}

function subscribe(onChange: () => void): () => void {
  // Another tab switched it: follow, and keep the document attribute in step.
  const onStorage = (event: StorageEvent) => {
    if (event.key === PRIVACY_STORAGE_KEY) {
      applyToDocument(readStored());
      onChange();
    }
  };
  window.addEventListener(PRIVACY_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(PRIVACY_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

/**
 * Whether privacy mode is on. False on the server and during hydration; most
 * amounts need no JS at all (CSS hides them), this is for what CSS cannot reach:
 * canvas charts and `title` tooltips.
 */
export function usePrivacyMode(): boolean {
  return useSyncExternalStore(subscribe, readStored, () => false);
}
