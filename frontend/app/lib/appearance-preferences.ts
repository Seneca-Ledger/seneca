'use client';

import { useEffect, useState } from 'react';
import { USER_FORMAT_EVENT } from '@/app/lib/user-format-store';
import type { UiDensity } from '@/app/theme';

export type AppearancePreferences = {
  density: UiDensity;
  reduceMotion: boolean;
};

const DEFAULTS: AppearancePreferences = { density: 'comfortable', reduceMotion: false };

const readStored = (): AppearancePreferences => {
  if (typeof window === 'undefined') return DEFAULTS;

  try {
    const raw = window.localStorage.getItem('user');
    if (!raw) return DEFAULTS;
    const user = JSON.parse(raw) as Partial<{ uiDensity: UiDensity; reduceMotion: boolean }>;
    return {
      density: user.uiDensity === 'compact' ? 'compact' : 'comfortable',
      reduceMotion: Boolean(user.reduceMotion),
    };
  } catch {
    return DEFAULTS;
  }
};

/**
 * Reads density and reduced motion off the persisted user.
 *
 * Starts from the defaults so the server render and the first client render
 * agree; the stored values arrive in an effect, which also re-themes the app the
 * moment the setting is saved.
 */
export function useAppearancePreferences(): AppearancePreferences {
  const [preferences, setPreferences] = useState<AppearancePreferences>(DEFAULTS);

  useEffect(() => {
    // Bail out when nothing changed: this hook sits at the root of <Providers>,
    // so a fresh object here would re-render the whole tree on every event.
    const sync = () =>
      setPreferences(prev => {
        const next = readStored();
        return prev.density === next.density && prev.reduceMotion === next.reduceMotion
          ? prev
          : next;
      });
    sync();

    window.addEventListener(USER_FORMAT_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(USER_FORMAT_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  // Motion is a document-level concern: the app renders no <CssBaseline />, so a
  // theme override would never reach the DOM. globals.css keys off this attribute.
  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(preferences.reduceMotion);
  }, [preferences.reduceMotion]);

  return preferences;
}
