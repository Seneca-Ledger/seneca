// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { LOCALE_COOKIE_NAME } from './locale';
import { formatStoredDateWithOptions, readStoredFormatPreferences } from './user-format-store';

const setCookieLocale = (locale: string | null) => {
  document.cookie = locale
    ? `${LOCALE_COOKIE_NAME}=${locale}; path=/`
    : `${LOCALE_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
};

const shortDay = { day: 'numeric', month: 'short' } as const;

describe('user-format-store', () => {
  afterEach(() => {
    setCookieLocale(null);
    window.localStorage.clear();
  });

  it('formats dates in the interface language, not the profile locale left at sign-up', () => {
    // The profile still says "en"; the reader switched the interface to Russian.
    window.localStorage.setItem('user', JSON.stringify({ locale: 'en', dateFormat: 'auto' }));
    setCookieLocale('ru');

    expect(readStoredFormatPreferences().locale).toBe('ru');
    const label = formatStoredDateWithOptions('2026-11-30T00:00:00', shortDay);
    expect(label).toMatch(/ноя/);
    expect(label).not.toMatch(/Nov/);
  });

  it('falls back to the profile locale when no interface language is set', () => {
    window.localStorage.setItem('user', JSON.stringify({ locale: 'en', dateFormat: 'auto' }));

    expect(formatStoredDateWithOptions('2026-11-30T00:00:00', shortDay)).toBe('Nov 30');
  });

  it('follows a language switch without a new user record', () => {
    window.localStorage.setItem('user', JSON.stringify({ locale: 'en', dateFormat: 'auto' }));
    setCookieLocale('en');
    expect(readStoredFormatPreferences().locale).toBe('en');

    setCookieLocale('ru');
    expect(readStoredFormatPreferences().locale).toBe('ru');
  });
});
