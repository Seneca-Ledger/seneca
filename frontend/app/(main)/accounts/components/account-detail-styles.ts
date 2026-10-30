import { tokens } from '@/lib/theme-tokens';

/** Shared look of the account page's cards and rows. */
export const cardStyle = {
  border: '1px solid var(--border)',
  borderRadius: tokens.radius.md,
  background: 'var(--card)',
  padding: 20,
  display: 'grid',
  gap: 12,
} as const;

export const titleStyle = { margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--foreground)' };
export const mutedStyle = { fontSize: 13, color: 'var(--text-muted)' } as const;
export const figureStyle = {
  fontSize: 14,
  fontWeight: 500,
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--foreground)',
} as const;
export const listRowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '10px 0',
  borderTop: '1px solid var(--border)',
} as const;

export const formatDay = (date: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(date),
  );
