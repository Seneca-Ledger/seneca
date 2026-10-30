export type ThemePreference = 'dark' | 'light' | 'system';
export type ResolvedAppTheme = 'dark' | 'light';

/** Follows the system until someone picks otherwise: new accounts and signed-out pages with no choice kept. */
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system';

export const THEME_STORAGE_EVENT = 'seneca-theme-preference-change';

export const resolveThemePreference = (value: unknown): ThemePreference => {
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value;
  }
  // The old name, still in browsers that cached the user before the rename.
  if (value === 'auto') {
    return 'system';
  }

  return DEFAULT_THEME_PREFERENCE;
};

/**
 * The last preference a signed-in user had, kept outside the `user` record:
 * logging out removes that record, and the sign-in page then fell back to the
 * default — a user who picked light got the system theme on sign-in.
 */
const LAST_THEME_PREFERENCE_KEY = 'seneca-last-theme-preference';

const readLastThemePreference = (): ThemePreference => {
  try {
    return resolveThemePreference(localStorage.getItem(LAST_THEME_PREFERENCE_KEY));
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
};

/** Mirrors the signed-in user's preference so signed-out pages keep it. */
export const rememberThemePreference = (preference: ThemePreference): void => {
  try {
    localStorage.setItem(LAST_THEME_PREFERENCE_KEY, preference);
  } catch {
    // Private mode: the sign-in page just follows the system.
  }
};

export const getStoredThemePreference = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME_PREFERENCE;
  }

  try {
    const rawUser = localStorage.getItem('user');
    if (!rawUser) {
      return readLastThemePreference();
    }

    const parsedUser = JSON.parse(rawUser) as { themePreference?: string };
    return resolveThemePreference(parsedUser?.themePreference);
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
};

/**
 * Removes the stored user record on sign-out, keeping their theme choice first
 * so the sign-in page that follows still honours it.
 */
export const forgetStoredUser = (): void => {
  try {
    const rawUser = localStorage.getItem('user');
    if (rawUser) {
      const parsed = JSON.parse(rawUser) as { themePreference?: string };
      if (parsed?.themePreference) {
        rememberThemePreference(resolveThemePreference(parsed.themePreference));
      }
    }
  } catch {
    // A corrupt record still has to go.
  }
  localStorage.removeItem('user');
};

/**
 * Last resolved mode, mirrored into a cookie so the server can render MUI in it.
 * Without it the SSR markup (and everything until hydration) uses the light
 * palette on a dark page: white cards, white skeletons.
 */
export const PALETTE_MODE_COOKIE = 'seneca-palette-mode';

/** No cookie yet (a first visit) paints dark until the client resolves the system theme. */
export const parsePaletteModeCookie = (value: string | undefined): ResolvedAppTheme =>
  value === 'light' ? 'light' : 'dark';

export const persistPaletteModeCookie = (mode: ResolvedAppTheme): void => {
  document.cookie = `${PALETTE_MODE_COOKIE}=${mode}; path=/; max-age=31536000; samesite=lax`;
};
