// @vitest-environment jsdom
import { useQueryClient } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetQueryClient } from './lib/query-client';

const workspaceState = vi.hoisted(() => ({
  currentWorkspaceId: 'workspace-1',
}));

const themeMocks = vi.hoisted(() => ({
  createAppTheme: vi.fn((_mode: string) => ({})),
  persistPaletteModeCookie: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@mui/material/styles', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

vi.mock('react-hot-toast', () => ({
  Toaster: () => <div data-testid="toaster" />,
}));

vi.mock('react-intlayer', () => ({
  IntlayerProviderContent: ({
    children,
    locale,
    setLocale,
  }: {
    children: React.ReactNode;
    locale: string;
    setLocale: (locale: string) => void;
  }) => (
    <>
      <div data-testid="intlayer-locale">{locale}</div>
      <button type="button" data-testid="set-locale-kk" onClick={() => setLocale('kk')}>
        set locale
      </button>
      {children}
    </>
  ),
  // The always-mounted keyboard shortcuts modal reads its dictionary on render.
  useIntlayer: () => {
    const node = (key: string): unknown =>
      new Proxy({ value: key }, { get: (target, prop: string) => (prop in target ? target.value : node(prop)) });
    return node('dictionary');
  },
}));

vi.mock('@/app/lib/theme-preference', () => ({
  DEFAULT_THEME_PREFERENCE: 'light',
  THEME_STORAGE_EVENT: 'lumio-theme-change',
  getStoredThemePreference: () => 'light',
  persistPaletteModeCookie: themeMocks.persistPaletteModeCookie,
  resolveThemePreference: (value: string) => value,
}));

vi.mock('./components/side-panel', () => ({
  SidePanelProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./contexts/NotificationContext', () => ({
  NotificationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./contexts/CurrencyDisplayContext', () => ({
  CurrencyDisplayProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./contexts/WorkspaceContext', () => ({
  WorkspaceProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useWorkspace: () => ({
    currentWorkspace: workspaceState.currentWorkspaceId
      ? { id: workspaceState.currentWorkspaceId }
      : null,
    loading: false,
  }),
}));

vi.mock('./hooks/useAutoTheme', () => ({
  useAutoTheme: vi.fn(),
}));

vi.mock('./hooks/useHTMLLanguage', () => ({
  useHTMLLanguage: vi.fn(),
}));

vi.mock('./theme', () => ({
  createAppTheme: themeMocks.createAppTheme,
}));

describe('Providers', () => {
  // Клиент — модульный синглтон, иначе тесты делили бы один кэш.
  afterEach(() => {
    resetQueryClient();
  });

  it('prefers locale from the intlayer cookie over server fallback locale', async () => {
    document.cookie = 'INTLAYER_LOCALE=kk; path=/';

    const { Providers } = await import('./providers');

    render(<Providers initialLocale="ru">test</Providers>);

    expect(screen.getByTestId('intlayer-locale').textContent).toBe('kk');
  });

  it('falls back to the legacy locale cookie while older sessions still exist', async () => {
    document.cookie = 'intlayer-locale=kk; path=/';

    const { Providers } = await import('./providers');

    render(<Providers initialLocale="ru">test</Providers>);

    expect(screen.getByTestId('intlayer-locale').textContent).toBe('kk');
  });

  it('stores selected locale in cookie when locale changes client-side', async () => {
    document.cookie = 'INTLAYER_LOCALE=; Max-Age=0; path=/';
    document.cookie = 'intlayer-locale=; Max-Age=0; path=/';

    const { Providers } = await import('./providers');

    render(<Providers initialLocale="en">test</Providers>);

    await act(async () => {
      screen.getByTestId('set-locale-kk').click();
    });

    expect(document.cookie).toContain('INTLAYER_LOCALE=kk');
    expect(screen.getByTestId('intlayer-locale').textContent).toBe('kk');
  });

  it('exposes a query client to the tree below', async () => {
    const { Providers } = await import('./providers');

    function Probe() {
      // Бросит, если QueryClientProvider отсутствует или стоит ниже потребителей.
      return <div data-testid="has-client">{typeof useQueryClient()}</div>;
    }

    render(
      <Providers initialLocale="en">
        <Probe />
      </Providers>,
    );

    expect(screen.getByTestId('has-client').textContent).toBe('object');
  });

  it('remounts workspace-scoped children when the active workspace changes', async () => {
    const { Providers } = await import('./providers');

    let instanceCounter = 0;

    function Probe() {
      const [instanceId] = React.useState(() => `probe-${++instanceCounter}`);

      return <div data-testid="probe">{instanceId}</div>;
    }

    const { rerender } = render(
      <Providers initialLocale="en">
        <Probe />
      </Providers>,
    );

    expect(screen.getByTestId('probe').textContent).toBe('probe-1');

    workspaceState.currentWorkspaceId = 'workspace-2';

    rerender(
      <Providers initialLocale="en">
        <Probe />
      </Providers>,
    );

    expect(screen.getByTestId('probe').textContent).toBe('probe-2');
  });

  it('renders the server markup in the palette mode remembered in the cookie', async () => {
    const { Providers } = await import('./providers');
    themeMocks.createAppTheme.mockClear();

    // No effects on the server: this is the pre-mount render the user sees before hydration.
    renderToString(<Providers initialLocale="en" initialPaletteMode="dark">test</Providers>);

    expect(themeMocks.createAppTheme.mock.calls.map(call => call[0])).toEqual(['dark']);
  });

  it('remembers the resolved palette mode for the next server render', async () => {
    const { Providers } = await import('./providers');
    themeMocks.persistPaletteModeCookie.mockClear();

    render(<Providers initialLocale="en" initialPaletteMode="dark">test</Providers>);

    expect(themeMocks.persistPaletteModeCookie).toHaveBeenLastCalledWith('light');
  });
});
