'use client';
import { tokens } from '@/lib/theme-tokens';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
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
            <h1 style={{ fontSize: 22, marginBottom: 12 }}>Something went wrong</h1>
            <p style={{ marginBottom: 16 }}>{error?.message || 'An unexpected error occurred.'}</p>
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
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
