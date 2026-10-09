import { afterEach, describe, expect, it } from 'vitest';
import {
  forgetStoredUser,
  getStoredThemePreference,
  rememberThemePreference,
} from './theme-preference';

describe('getStoredThemePreference', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("reads the signed-in user's own preference", () => {
    localStorage.setItem('user', JSON.stringify({ themePreference: 'dark' }));
    rememberThemePreference('light');
    expect(getStoredThemePreference()).toBe('dark');
  });

  it('keeps the last chosen preference after logout removed the user record', () => {
    rememberThemePreference('light');
    expect(getStoredThemePreference()).toBe('light');
  });

  it('falls back to the auto schedule when nothing was ever chosen', () => {
    expect(getStoredThemePreference()).toBe('auto');
  });

  it('signing out keeps the theme the user had chosen', () => {
    localStorage.setItem('user', JSON.stringify({ themePreference: 'light' }));
    forgetStoredUser();
    expect(localStorage.getItem('user')).toBeNull();
    expect(getStoredThemePreference()).toBe('light');
  });
});
