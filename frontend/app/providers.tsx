'use client';

import { ThemeProvider } from '@mui/material/styles';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { QueryClientProvider } from '@tanstack/react-query';
import { useTheme as useNextTheme } from 'next-themes';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { IntlayerProviderContent } from 'react-intlayer';
import { useAppearancePreferences } from '@/app/lib/appearance-preferences';
import {
  type AppLocale,
  isSupportedLocale,
  persistLocaleToCookie,
  readLocaleFromCookie,
} from '@/app/lib/locale';
import { getQueryClient } from '@/app/lib/query-client';
import {
  getStoredThemePreference,
  persistPaletteModeCookie,
  type ResolvedAppTheme,
  resolveThemePreference,
  THEME_STORAGE_EVENT,
} from '@/app/lib/theme-preference';
import { KeyboardShortcutsProvider } from './components/keyboard-shortcuts-provider';
import { OfflineBanner } from './components/pwa/OfflineBanner';
import { ServiceWorkerRegistrar } from './components/pwa/ServiceWorkerRegistrar';
import { AuthProvider } from './contexts/AuthContext';
import { CurrencyDisplayProvider } from './contexts/CurrencyDisplayContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { useWorkspace, WorkspaceProvider } from './contexts/WorkspaceContext';
import { useAutoTheme } from './hooks/useAutoTheme';
import { useHTMLLanguage } from './hooks/useHTMLLanguage';
import { createAppTheme } from './theme';

const TOASTER_OPTS = {
  duration: 3000,
  style: {
    fontSize: '14px',
    background: 'var(--card-bg)',
    color: 'var(--foreground)',
    border: '1px solid var(--border-color)',
  },
};

function HtmlLanguageSync(): null {
  useHTMLLanguage();
  return null;
}

function ThemePreferenceSync(): null {
  const [themePreference, setThemePreference] = useState(getStoredThemePreference);

  useEffect(() => {
    const syncThemePreference = (): void => {
      setThemePreference(resolveThemePreference(getStoredThemePreference()));
    };
    const handleThemePreferenceEvent = (): void => {
      syncThemePreference();
    };
    window.addEventListener('storage', syncThemePreference);
    window.addEventListener(THEME_STORAGE_EVENT, handleThemePreferenceEvent);
    return (): void => {
      window.removeEventListener('storage', syncThemePreference);
      window.removeEventListener(THEME_STORAGE_EVENT, handleThemePreferenceEvent);
    };
  }, []);

  useAutoTheme(themePreference);
  return null;
}

function WorkspaceScopedProviders({
  children,
  mounted,
}: {
  children: React.ReactNode;
  mounted: boolean;
}): React.JSX.Element {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? null;
  // Page hooks mostly do not refetch on workspace change, so a real switch
  // between two loaded workspaces remounts the page tree. The initial
  // null -> id transition on every page load must NOT remount: it would throw
  // away all page state and redo every request just after the first render.
  const [initialWorkspaceId, setInitialWorkspaceId] = useState(workspaceId);
  if (initialWorkspaceId === null && workspaceId !== null) {
    setInitialWorkspaceId(workspaceId);
  }
  const scopeKey =
    workspaceId === null || workspaceId === initialWorkspaceId ? 'initial' : workspaceId;
  return (
    <CurrencyDisplayProvider>
      <NotificationProvider>
        <KeyboardShortcutsProvider>
          {mounted ? <Toaster position="top-center" toastOptions={TOASTER_OPTS} /> : null}
          {mounted ? (
            <>
              <ServiceWorkerRegistrar />
              <OfflineBanner />
            </>
          ) : null}
          <React.Fragment key={scopeKey}>{children}</React.Fragment>
        </KeyboardShortcutsProvider>
      </NotificationProvider>
    </CurrencyDisplayProvider>
  );
}

export function Providers({
  children,
  initialLocale,
  initialPaletteMode = 'light',
}: {
  children: React.ReactNode;
  initialLocale: AppLocale;
  initialPaletteMode?: ResolvedAppTheme;
}): React.JSX.Element {
  const { resolvedTheme } = useNextTheme();
  const [mounted, setMounted] = useState(false);
  const [locale, setLocale] = useState<AppLocale>(() => readLocaleFromCookie() ?? initialLocale);
  // Before mount, the server's guess from the cookie, so hydration matches the SSR markup.
  const paletteMode: ResolvedAppTheme =
    mounted && resolvedTheme ? (resolvedTheme === 'dark' ? 'dark' : 'light') : initialPaletteMode;
  const { density, reduceMotion } = useAppearancePreferences();
  const muiTheme = useMemo(
    () => createAppTheme(paletteMode, { density, reduceMotion }),
    [paletteMode, density, reduceMotion],
  );
  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    if (mounted && resolvedTheme) persistPaletteModeCookie(paletteMode);
  }, [mounted, resolvedTheme, paletteMode]);
  useEffect(() => {
    setLocale(readLocaleFromCookie() ?? initialLocale);
  }, [initialLocale]);
  useEffect(() => {
    persistLocaleToCookie(locale);
  }, [locale]);
  const handleLocaleChange = useCallback((nextLocale: string): void => {
    if (!isSupportedLocale(nextLocale)) return;
    persistLocaleToCookie(nextLocale);
    setLocale(nextLocale);
  }, []);
  return (
    <IntlayerProviderContent locale={locale} setLocale={handleLocaleChange}>
      <HtmlLanguageSync />
      <ThemePreferenceSync />
      <ThemeProvider theme={muiTheme}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          {/* Выше AuthProvider и WorkspaceProvider: их собственные запросы —
              следующие цели миграции, а NotificationProvider внутри
              WorkspaceScopedProviders уже использует кэш. Строго вне
              WorkspaceScopedProviders: внутри время жизни кэша привязалось бы к
              идентичности воркспейса вместо сегмента workspaceId в ключе. */}
          <QueryClientProvider client={getQueryClient()}>
            <AuthProvider>
              <WorkspaceProvider>
                <WorkspaceScopedProviders mounted={mounted}>{children}</WorkspaceScopedProviders>
              </WorkspaceProvider>
            </AuthProvider>
          </QueryClientProvider>
        </LocalizationProvider>
      </ThemeProvider>
    </IntlayerProviderContent>
  );
}
