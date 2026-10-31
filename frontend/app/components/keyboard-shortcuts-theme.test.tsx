// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { type Context, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@/app/hooks/useAuth';
import { THEME_STORAGE_EVENT } from '@/app/lib/theme-preference';
import { renderWithQuery } from '@/app/test/query-wrapper';

const apiMocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
const themeMocks = vi.hoisted(() => ({ resolvedTheme: 'light', setTheme: vi.fn() }));

vi.mock('@/app/lib/api', () => ({ default: apiMocks }));
vi.mock('next-themes', () => ({ useTheme: () => themeMocks }));
// A context of the test's own, so a setUser re-renders everything that reads it, as in the app.
vi.mock('@/app/hooks/useAuth', async () => {
  const { createContext, useContext } = await import('react');
  const TestAuthContext = createContext<unknown>(null);
  return { TestAuthContext, useAuth: () => useContext(TestAuthContext) };
});
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/dashboard',
}));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ hasPermission: () => true }),
}));

import * as authModule from '@/app/hooks/useAuth';
import { useAppearance } from '@/app/settings/profile/hooks/useAppearance';
import { openCommandPalette } from './command-palette/command-palette-store';
import { KeyboardShortcutsProvider } from './keyboard-shortcuts-provider';

type TestAuth = { user: User | null; setUser: (user: User) => void };
const { TestAuthContext } = authModule as unknown as { TestAuthContext: Context<TestAuth> };

const MEMBER: User = {
  id: 'user-1',
  email: 'member-1@example.com',
  name: 'Member One',
  role: 'user',
  workspaceId: 'ws-1',
  permissions: null,
  telegramId: null,
  telegramChatId: null,
  locale: 'en',
  timeZone: null,
  dateFormat: 'auto',
  firstDayOfWeek: null,
  uiDensity: 'comfortable',
  reduceMotion: false,
  showDailyQuote: true,
  roundAmounts: true,
  themePreference: 'system',
  mapStylePreference: null,
  lastLogin: null,
  avatarUrl: null,
  onboardingCompletedAt: null,
  welcomeTutorialSeenAt: null,
  pageHintsSeen: {},
} as User;

/** Holds the signed-in user the way AuthProvider does, for every hook below it. */
function AuthHarness({
  initial,
  children,
}: {
  initial: User | null;
  children: React.ReactNode;
}): React.ReactNode {
  const [user, setUser] = useState<User | null>(initial);
  return <TestAuthContext.Provider value={{ user, setUser }}>{children}</TestAuthContext.Provider>;
}

/** The theme switch on Settings → General reads the same hook. */
function SettingsTheme(): React.JSX.Element {
  const { user, setUser } = authModule.useAuth() as unknown as TestAuth;
  const { themePreference } = useAppearance(user, setUser, {
    successFallback: 'Saved',
    errorFallback: 'Failed',
  });
  return <output data-testid="settings-theme">{themePreference}</output>;
}

function renderApp(user: User | null): void {
  renderWithQuery(
    <AuthHarness initial={user}>
      <KeyboardShortcutsProvider>
        <SettingsTheme />
      </KeyboardShortcutsProvider>
    </AuthHarness>,
  );
}

const pressToggleTheme = (): void => {
  fireEvent.keyDown(document.body, { key: 'T', code: 'KeyT', altKey: true, shiftKey: true });
};

beforeEach(() => {
  apiMocks.get.mockReset();
  apiMocks.get.mockResolvedValue({ data: { data: { query: '', results: [] } } });
  apiMocks.patch.mockReset();
  apiMocks.patch.mockImplementation((_url: string, body: { themePreference: string }) =>
    Promise.resolve({ data: { user: { ...MEMBER, themePreference: body.themePreference } } }),
  );
  themeMocks.resolvedTheme = 'light';
  themeMocks.setTheme.mockReset();
  localStorage.setItem('user', JSON.stringify(MEMBER));
});

afterEach(() => {
  localStorage.clear();
});

describe('toggling the theme from the keyboard', () => {
  it('moves the Settings switch to the new theme', async () => {
    renderApp(MEMBER);
    expect(screen.getByTestId('settings-theme').textContent).toBe('system');

    act(pressToggleTheme);

    await waitFor(() => expect(screen.getByTestId('settings-theme').textContent).toBe('dark'));
    expect(themeMocks.setTheme).toHaveBeenCalledWith('dark');
  });

  it('saves the choice, so the schedule of an Auto preference does not undo it', async () => {
    const changes: unknown[] = [];
    const listen = (event: Event): void => {
      changes.push((event as CustomEvent).detail);
    };
    window.addEventListener(THEME_STORAGE_EVENT, listen);
    themeMocks.resolvedTheme = 'dark';
    renderApp(MEMBER);

    act(pressToggleTheme);

    await waitFor(() =>
      expect(apiMocks.patch).toHaveBeenCalledWith('/users/me/preferences', {
        themePreference: 'light',
      }),
    );
    // What ThemePreferenceSync reads back to decide the theme.
    expect(JSON.parse(localStorage.getItem('user') ?? '{}').themePreference).toBe('light');
    expect(changes).toContainEqual({ themePreference: 'light' });
    window.removeEventListener(THEME_STORAGE_EVENT, listen);
  });

  it('only flips the page when nobody is signed in', () => {
    localStorage.clear();
    renderApp(null);

    act(pressToggleTheme);

    expect(themeMocks.setTheme).toHaveBeenCalledWith('dark');
    expect(apiMocks.patch).not.toHaveBeenCalled();
  });
});

describe('toggling the theme from the command palette', () => {
  it('moves the Settings switch too', async () => {
    renderApp(MEMBER);
    act(() => openCommandPalette());

    fireEvent.click(await screen.findByText('Toggle theme'));

    await waitFor(() => expect(screen.getByTestId('settings-theme').textContent).toBe('dark'));
    expect(apiMocks.patch).toHaveBeenCalledWith('/users/me/preferences', {
      themePreference: 'dark',
    });
  });
});
