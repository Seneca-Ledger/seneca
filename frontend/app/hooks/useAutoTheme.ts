'use client';

import { useTheme } from 'next-themes';
import { useEffect } from 'react';
import type { ThemePreference } from '@/app/lib/theme-preference';
import { getScheduledTheme, getStoredThemeTimeZone } from '@/app/lib/theme-preference';

const AUTO_THEME_CHECK_INTERVAL_MS = 60_000;

export function useAutoTheme(themePreference: ThemePreference) {
  const { setTheme } = useTheme();

  useEffect(() => {
    if (themePreference !== 'auto') {
      setTheme(themePreference);
      return;
    }

    const applyScheduledTheme = () => {
      setTheme(getScheduledTheme(getStoredThemeTimeZone()));
    };

    applyScheduledTheme();

    const intervalId = window.setInterval(applyScheduledTheme, AUTO_THEME_CHECK_INTERVAL_MS);
    window.addEventListener('focus', applyScheduledTheme);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', applyScheduledTheme);
    };
  }, [setTheme, themePreference]);
}
