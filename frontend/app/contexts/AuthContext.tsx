'use client';

import { usePathname, useRouter } from 'next/navigation';
import type React from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import apiClient from '@/app/lib/api';
import { clearCsrfCookie, hasSessionCookie } from '@/app/lib/csrf';
import { readLocaleFromCookie, syncLocaleFromUser } from '@/app/lib/locale';
import { getQueryClient } from '@/app/lib/query-client';
import {
  DEFAULT_THEME_PREFERENCE,
  forgetStoredUser,
  resolveThemePreference,
  THEME_STORAGE_EVENT,
  type ThemePreference,
} from '@/app/lib/theme-preference';
import type { DateFormatPreference } from '@/app/lib/user-format';
import { notifyUserFormatChanged } from '@/app/lib/user-format-store';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  workspaceId?: string | null;
  permissions?: string[] | null;
  telegramId?: string | null;
  telegramChatId?: string | null;
  locale?: string;
  timeZone?: string | null;
  dateFormat?: DateFormatPreference;
  firstDayOfWeek?: number | null;
  uiDensity?: 'comfortable' | 'compact';
  reduceMotion?: boolean;
  /** Daily-quote banner above the pages; absent means on. */
  showDailyQuote?: boolean;
  themePreference?: ThemePreference;
  /** Tile style picked on receipt maps; null follows the server default. */
  mapStylePreference?: string | null;
  lastLogin?: string | null;
  avatarUrl?: string | null;
  onboardingCompletedAt?: string | null;
  /** When the welcome tutorial was closed; null opens it after sign-up. */
  welcomeTutorialSeenAt?: string | null;
}

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const normalizeUser = (user: User): User => ({
  ...user,
  themePreference: resolveThemePreference(user.themePreference ?? DEFAULT_THEME_PREFERENCE),
});

const clearStoredSession = (): void => {
  // Tokens now live in httpOnly cookies that only the server can clear. These
  // two removals stay to evict values left over from before that migration.
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  forgetStoredUser();
  // The CSRF cookie is readable, so it is ours to clear — and it must be, or
  // the next mount still believes there is a session.
  clearCsrfCookie();
  // Кэш React Query переживает смену пользователя в той же вкладке, поэтому
  // чистится вместе с токенами — и на логауте, и на невалидном /auth/me.
  getQueryClient().clear();
};

const needsOnboarding = (user: User, pathname: string): boolean =>
  user.onboardingCompletedAt == null &&
  !pathname.startsWith('/onboarding') &&
  !pathname.startsWith('/login') &&
  !pathname.startsWith('/register') &&
  !pathname.startsWith('/invite/');

/**
 * Single owner of the signed-in user. Every `useAuth()` call used to hold its
 * own copy of this state and issue its own `/auth/me` request; now the profile
 * is loaded once per access token and shared through context.
 */
export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Whether the profile has been loaded for the current session. The access
  // token itself is httpOnly and unreadable now, so session presence is tracked
  // through the companion CSRF cookie, which the server sets and clears
  // alongside it. Re-checked on navigation so a logout in this tab is noticed
  // without a full reload.
  const loadedSessionRef = useRef(false);

  useEffect(() => {
    if (!hasSessionCookie()) {
      if (loadedSessionRef.current) {
        loadedSessionRef.current = false;
        setUser(null);
      }
      setLoading(false);
      return;
    }
    if (loadedSessionRef.current) {
      return;
    }
    loadedSessionRef.current = true;

    apiClient
      .get('/auth/me')
      .then(response => {
        const nextUser = normalizeUser(response.data as User);
        setUser(nextUser);
        localStorage.setItem('user', JSON.stringify(nextUser));
        notifyUserFormatChanged();
        if (readLocaleFromCookie() == null) {
          syncLocaleFromUser(nextUser);
        }
        window.dispatchEvent(new CustomEvent(THEME_STORAGE_EVENT));
        if (needsOnboarding(nextUser, window.location.pathname)) {
          router.push('/onboarding');
        }
      })
      .catch(() => {
        // Session invalid — drop the local copy and bounce to login. Guarded so
        // an invalid session on the login page itself cannot re-navigate to it.
        loadedSessionRef.current = false;
        clearStoredSession();
        if (!window.location.pathname.startsWith('/login')) {
          router.push('/login');
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router, pathname]);

  const logout = useCallback(async () => {
    // No try/finally: React Compiler skips components containing one.
    await apiClient.post('/auth/logout').catch((error: unknown) => {
      console.error('Logout error:', error);
    });
    loadedSessionRef.current = false;
    clearStoredSession();
    setUser(null);
    router.push('/login');
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, logout, setUser }),
    [user, loading, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
