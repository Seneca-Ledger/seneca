'use client';

import { useTheme } from 'next-themes';
import { useEffect } from 'react';
import type { ThemePreference } from '@/app/lib/theme-preference';

export function useAutoTheme(themePreference: ThemePreference) {
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme(themePreference);
  }, [setTheme, themePreference]);
}
