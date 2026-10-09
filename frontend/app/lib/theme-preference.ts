export type ThemePreference = 'light' | 'dark' | 'auto';
export type ResolvedAppTheme = 'light' | 'dark';

export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'auto';

export const THEME_STORAGE_EVENT = 'lumio-theme-preference-change';

export const resolveThemePreference = (value: unknown): ThemePreference => {
  if (value === 'light' || value === 'dark' || value === 'auto') {
    return value;
  }

  return DEFAULT_THEME_PREFERENCE;
};

/**
 * The last preference a signed-in user had, kept outside the `user` record:
 * logging out removes that record, and the sign-in page then fell back to the
 * time-of-day schedule — a user who picked light got a dark sign-in at night.
 */
const LAST_THEME_PREFERENCE_KEY = 'lumio-last-theme-preference';

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
    // Private mode: the sign-in page just follows the schedule.
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

export const getStoredThemeTimeZone = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = localStorage.getItem('user');
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { timeZone?: string | null };
    return typeof parsed?.timeZone === 'string' && parsed.timeZone.trim() ? parsed.timeZone : null;
  } catch {
    return null;
  }
};

const getHourForTimeZone = (timeZone: string | null) => {
  if (!timeZone) {
    return new Date().getHours();
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone,
  }).formatToParts(new Date());

  const hourValue = parts.find(part => part.type === 'hour')?.value;
  const parsedHour = Number.parseInt(hourValue || '', 10);

  return Number.isFinite(parsedHour) ? parsedHour : new Date().getHours();
};

export const getScheduledTheme = (timeZone: string | null): ResolvedAppTheme => {
  const hour = getHourForTimeZone(timeZone);
  return hour >= 7 && hour < 19 ? 'light' : 'dark';
};

/**
 * Last resolved mode, mirrored into a cookie so the server can render MUI in it.
 * Without it the SSR markup (and everything until hydration) uses the light
 * palette on a dark page: white cards, white skeletons.
 */
export const PALETTE_MODE_COOKIE = 'lumio-palette-mode';

export const parsePaletteModeCookie = (value: string | undefined): ResolvedAppTheme =>
  value === 'dark' ? 'dark' : 'light';

export const persistPaletteModeCookie = (mode: ResolvedAppTheme): void => {
  document.cookie = `${PALETTE_MODE_COOKIE}=${mode}; path=/; max-age=31536000; samesite=lax`;
};
