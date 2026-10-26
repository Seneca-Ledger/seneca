'use client';

import { useTheme } from 'next-themes';
import { useAuth } from '@/app/hooks/useAuth';
import { useThemePreference } from './useThemePreference';

/**
 * Light ↔ dark from a shortcut or the palette, saved as the user's preference
 * the way the account menu saves it. Only flipping next-themes left Settings on
 * the old choice, and an Auto preference put the schedule back within a minute.
 * Signed out there is no preference to save, so it just flips the page.
 */
export function useThemeToggle(): () => void {
  const { user, setUser } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const { handleThemePreferenceChange } = useThemePreference({
    userThemePreference: user?.themePreference,
    user,
    setUser,
    setTheme,
  });

  return () => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark';
    if (user) void handleThemePreferenceChange(next);
    else setTheme(next);
  };
}
