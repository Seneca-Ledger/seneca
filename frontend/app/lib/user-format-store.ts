'use client';

import { useEffect, useMemo, useState } from 'react';
import { readLocaleFromCookie } from '@/app/lib/locale';
import type { UserFormatPreferences } from '@/app/lib/user-format';
import { formatDate, formatDateTime, formatDateWithOptions } from '@/app/lib/user-format';

/** Fired whenever the persisted user changes, so open views re-render dates. */
export const USER_FORMAT_EVENT = 'lumio:user-format-changed';

const EMPTY: UserFormatPreferences = {};

/**
 * Reads format preferences off the persisted user.
 *
 * Plain helpers (table renderers, cell formatters) cannot take a hook and
 * threading preferences through every signature would touch far more code than
 * it buys, so they read the same stored user the app already keeps in sync.
 */
// Parsed once per distinct stored value: the formatters below run inside table
// row renders, so re-parsing the user JSON on every call is measurable.
let cachedRaw: string | null = null;
let cachedCookie: string | null = null;
let cachedPreferences: UserFormatPreferences = EMPTY;

export const readStoredFormatPreferences = (): UserFormatPreferences => {
  if (typeof window === 'undefined') {
    return EMPTY;
  }

  try {
    const raw = window.localStorage.getItem('user');
    if (!raw) return EMPTY;
    const cookie = document.cookie;
    if (raw === cachedRaw && cookie === cachedCookie) return cachedPreferences;
    const user = JSON.parse(raw) as UserFormatPreferences;
    cachedRaw = raw;
    cachedCookie = cookie;
    cachedPreferences = {
      // The interface language lives in the locale cookie; the profile's
      // `locale` only seeds it at sign-in and is not updated when the reader
      // switches language, so dates follow the cookie.
      locale: readLocaleFromCookie() ?? user.locale ?? null,
      dateFormat: user.dateFormat ?? null,
      firstDayOfWeek: user.firstDayOfWeek ?? null,
    };
    return cachedPreferences;
  } catch {
    return EMPTY;
  }
};

type DateInput = Date | string | number | null | undefined;

/**
 * Drop-in replacements for `new Date(x).toLocaleDateString(...)` in plain helpers.
 * `locale` overrides the stored one for call sites that already track the active
 * interface language themselves.
 */
export const formatStoredDate = (value: DateInput, locale?: string | null): string =>
  formatDate(value, { ...readStoredFormatPreferences(), ...(locale ? { locale } : {}) });

export const formatStoredDateTime = (value: DateInput, locale?: string | null): string =>
  formatDateTime(value, { ...readStoredFormatPreferences(), ...(locale ? { locale } : {}) });

/** Keeps the call site's own Intl options while honouring an explicit date order. */
export const formatStoredDateWithOptions = (
  value: DateInput,
  options: Intl.DateTimeFormatOptions,
  locale?: string | null,
): string =>
  formatDateWithOptions(
    value,
    { ...readStoredFormatPreferences(), ...(locale ? { locale } : {}) },
    options,
  );

export const notifyUserFormatChanged = (): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(USER_FORMAT_EVENT));
  }
};

export type UseUserFormatReturn = {
  preferences: UserFormatPreferences;
  formatDate: (value: Date | string | number | null | undefined) => string;
  formatDateTime: (value: Date | string | number | null | undefined) => string;
};

/**
 * Preference-aware formatters for components.
 *
 * Starts from empty preferences so the server and the first client render agree;
 * the stored values arrive in an effect, which is also what re-renders dates
 * right after the user changes the setting.
 */
export function useUserFormat(): UseUserFormatReturn {
  const [preferences, setPreferences] = useState<UserFormatPreferences>(EMPTY);

  useEffect(() => {
    const sync = () =>
      setPreferences(prev => {
        const next = readStoredFormatPreferences();
        return prev.locale === next.locale &&
          prev.dateFormat === next.dateFormat &&
          prev.firstDayOfWeek === next.firstDayOfWeek
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

  return useMemo(
    () => ({
      preferences,
      formatDate: value => formatDate(value, preferences),
      formatDateTime: value => formatDateTime(value, preferences),
    }),
    [preferences],
  );
}
