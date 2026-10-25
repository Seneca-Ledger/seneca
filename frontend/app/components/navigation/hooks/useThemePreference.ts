'use client';

import { type Dispatch, type SetStateAction, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import type { User } from '@/app/hooks/useAuth';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
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
}

export function useThemePreference({
  userThemePreference,
  user,
  setUser,
  setTheme,
}: UseThemePreferenceParams) {
  const themeUpdateFailed = useIntlayer('navigation').userMenu.themeUpdateFailed.value;
  const [selectedTheme, setSelectedTheme] = useState<ThemePreference>(() =>
    getStoredThemePreference(),
  );

  useEffect(() => {
    setSelectedTheme(resolveThemePreference(userThemePreference ?? getStoredThemePreference()));
  }, [userThemePreference]);

  const handleThemePreferenceChange = useCallback(
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

        const { user: updatedUser } = await checkContract(
          'UserUpdateResponse',
          response.data,
          '/users/me/preferences',
        );
        if (previousUser) {
          const mergedUser = {
            ...previousUser,
            ...updatedUser,
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
        toast.error(themeUpdateFailed);
      });
    },
    [selectedTheme, user, setUser, setTheme, themeUpdateFailed],
  );

  return { selectedTheme, handleThemePreferenceChange };
}
