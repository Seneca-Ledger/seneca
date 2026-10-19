import Link from 'next/link';

export const dynamic = 'force-static';

/**
 * Served by the service worker when a navigation has no network. Plain on
 * purpose: nothing here may depend on an API call.
 */
export default function OfflinePage() {
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
      <h1 style={{ fontSize: 22, margin: 0 }}>You are offline</h1>
      <p style={{ margin: 0, maxWidth: 420, color: '#6b7280' }}>
        Expenses and receipt photos you add now are kept on this device and sent as soon as the
        connection is back.
      </p>
      <Link href="/statements/submit?openExpenseDrawer=manual" style={{ color: '#0584c7' }}>
        Add an expense anyway
      </Link>
    </main>
  );
}
