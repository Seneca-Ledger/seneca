'use client';

import { type Dispatch, type SetStateAction, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import type { User } from '@/app/hooks/useAuth';
import apiClient from '@/app/lib/api';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import {
  getScheduledTheme,
  getStoredThemePreference,
  getStoredThemeTimeZone,
  resolveThemePreference,
  THEME_STORAGE_EVENT,
  type ThemePreference,
} from '@/app/lib/theme-preference';

interface UseThemePreferenceParams {
  userThemePreference: ThemePreference | undefined;
  user: User | null;
  setUser: Dispatch<SetStateAction<User | null>>;
  setTheme: (theme: string) => void;
  resolveLabel: (token: unknown, fallback: string) => string;
  navTheme: unknown;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types, max-lines-per-function
export function useThemePreference({
  userThemePreference,
  user,
  setUser,
  setTheme,
  resolveLabel,
  navTheme,
}: UseThemePreferenceParams) {
  const [selectedTheme, setSelectedTheme] = useState<ThemePreference>(() =>
    getStoredThemePreference(),
  );

  useEffect(() => {
    setSelectedTheme(resolveThemePreference(userThemePreference ?? getStoredThemePreference()));
  }, [userThemePreference]);

  const handleThemePreferenceChange = useCallback(
    // eslint-disable-next-line max-lines-per-function
    async (nextThemePreference: ThemePreference) => {
      const previousThemePreference = selectedTheme;
      const previousUser = user;
      const nextResolvedTheme =
        nextThemePreference === 'auto'
          ? getScheduledTheme(getStoredThemeTimeZone())
          : nextThemePreference;

      setSelectedTheme(nextThemePreference);
      setTheme(nextResolvedTheme);

      if (previousUser) {
        const optimisticUser = { ...previousUser, themePreference: nextThemePreference };
        setUser(optimisticUser);
        localStorage.setItem('user', JSON.stringify(optimisticUser));
      }

      window.dispatchEvent(
        new CustomEvent(THEME_STORAGE_EVENT, {
          detail: { themePreference: nextThemePreference },
        }),
      );

      await (async () => {
        const response = await apiClient.patch('/users/me/preferences', {
          themePreference: nextThemePreference,
        } satisfies ContractInput<'UpdateMyPreferencesBody'>);

        if (previousUser) {
          const mergedUser = {
            ...previousUser,
            ...(response.data?.user || {}),
            themePreference: nextThemePreference,
          };
          setUser(mergedUser);
          localStorage.setItem('user', JSON.stringify(mergedUser));
        }
      })().catch(async () => {
        setSelectedTheme(previousThemePreference);
        setTheme(
          previousThemePreference === 'auto'
            ? getScheduledTheme(getStoredThemeTimeZone())
            : previousThemePreference,
        );

        if (previousUser) {
          setUser(previousUser);
          localStorage.setItem('user', JSON.stringify(previousUser));
        }

        window.dispatchEvent(
          new CustomEvent(THEME_STORAGE_EVENT, {
            detail: { themePreference: previousThemePreference },
          }),
        );
        toast.error(resolveLabel(navTheme, 'Failed to update theme'));
      });
    },
    [selectedTheme, user, setUser, setTheme, resolveLabel, navTheme],
  );

  return { selectedTheme, handleThemePreferenceChange };
}
