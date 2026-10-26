'use client';
import { useSyncExternalStore } from 'react';
import { GLOBAL_ERROR_TEXT } from '@/app/lib/global-error-translations';
import {
  type AppLocale,
  DEFAULT_LOCALE,
  normalizeLocale,
  readLocaleFromCookie,
} from '@/app/lib/locale';
import { tokens } from '@/lib/theme-tokens';

const subscribe = (): (() => void) => () => {};

/** The saved language, else the browser's; read without any provider. */
function readBrowserLocale(): AppLocale {
  const browser = navigator.language?.split('-')[0]?.toLowerCase();
  return readLocaleFromCookie() ?? normalizeLocale(browser);
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useSyncExternalStore(subscribe, readBrowserLocale, () => DEFAULT_LOCALE);
  const text = GLOBAL_ERROR_TEXT[locale];
  return (
    <html lang={locale}>
      <body>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
            padding: 24,
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: 520 }}>
            <h1 style={{ fontSize: 22, marginBottom: 12 }}>{text.headline}</h1>
            <p style={{ marginBottom: 16 }}>{error?.message || text.fallback}</p>
            <button
              type="button"
              onClick={reset}
              style={{
                padding: '10px 16px',
                borderRadius: tokens.radius.lg,
                border: '1px solid var(--border-color)',
                background: 'var(--card-bg)',
                cursor: 'pointer',
              }}
            >
              {text.retry}
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
