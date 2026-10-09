'use client';

import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { tokens } from '@/lib/theme-tokens';

/** The one look every statements toolbar control wears — Date, Filters, From and
 *  Columns alike: a square-ish white button with dark text, not an accent pill. */
export const TOOLBAR_BUTTON_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  whiteSpace: 'nowrap',
  flexShrink: 0,
  // Sized off the primary button beside it (theme.ts, MuiButton root), so the row
  // reads as one set of controls.
  minHeight: 40,
  borderRadius: tokens.radius.md,
  border: '1px solid var(--border-color)',
  background: 'var(--card-bg)',
  padding: '8px 14px',
  fontSize: 14,
  fontWeight: 600,
  lineHeight: 1.4,
  color: 'var(--foreground)',
  cursor: 'pointer',
};

export const StatementsToolbarButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(({ children, style, ...props }, ref) => (
  <button ref={ref} type="button" style={{ ...TOOLBAR_BUTTON_STYLE, ...style }} {...props}>
    {children}
  </button>
));

StatementsToolbarButton.displayName = 'StatementsToolbarButton';
