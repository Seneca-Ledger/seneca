'use client';

import Link from 'next/link';
import type React from 'react';
import { useIntlayer } from '@/app/i18n';

/**
 * The static HTML carries the default language; once the cached scripts run,
 * the providers switch to the locale cookie like on any other page.
 */
export function OfflineView(): React.JSX.Element {
  const t = useIntlayer('offlinePage');

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 24,
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ fontSize: 22, margin: 0 }}>{t.title}</h1>
      <p style={{ margin: 0, maxWidth: 420, color: 'var(--text-muted)' }}>{t.description}</p>
      <Link href="/statements/submit?openExpenseDrawer=manual" style={{ color: 'var(--primary)' }}>
        {t.addExpense}
      </Link>
    </main>
  );
}
