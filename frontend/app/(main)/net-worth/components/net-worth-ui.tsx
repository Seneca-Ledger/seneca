'use client';

import Typography from '@mui/material/Typography';
import type React from 'react';
import { formatMoney } from '@/app/lib/format-money';
import { tokens } from '@/lib/theme-tokens';

/** The white block every section of the page sits in. */
export const cardSx = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: tokens.radius.md,
  bgcolor: 'background.paper',
  p: 3,
} as const;

/** A card's title: sentence case and a medium weight, like the table headers. */
export function CardTitle({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <Typography component="h2" sx={{ fontSize: 15, fontWeight: 500, color: 'text.primary' }}>
      {children}
    </Typography>
  );
}

/**
 * A large sum on the overview in whole units ("€184,593"); the cents are noise
 * at that size, so they wait in the tooltip.
 */
export function WholeMoney({
  value,
  currency,
  locale,
}: {
  value: number;
  currency: string;
  locale: string;
}): React.JSX.Element {
  return (
    <span title={formatMoney(value, currency, locale)}>
      {formatMoney(value, currency, locale, { fractionDigits: 0 })}
    </span>
  );
}

/**
 * "III. Cash" → "Cash". The numerals are balance-sheet article numbers, which
 * mean nothing to the reader and look out of order once lines sort by size.
 */
export function plainLineName(name: string): string {
  return name.replace(/^[IVXLC]+\.\s+/, '');
}
