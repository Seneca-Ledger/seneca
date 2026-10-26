'use client';

import Box from '@mui/material/Box';
import type React from 'react';
import { LogoAvatar } from '@/app/components/LogoAvatar';
import { apiBaseUrl } from '@/app/lib/api';

/**
 * The coin's own logo, through the API's icon proxy, with a monogram behind it.
 *
 * Nothing is bundled: the proxy fetches the mark from the price source and
 * caches it, so a coin we start pricing arrives with its logo and no file in
 * this repository ever goes stale. A ticker the source does not know answers
 * 404, and the monogram stays.
 */
export function TokenIcon({
  asset,
  size = 24,
}: {
  asset: string;
  size?: number;
}): React.JSX.Element {
  const ticker = asset.toUpperCase();
  const mark = Math.round(size * 0.66);

  // One neutral circle with the mark in grey: brand colours repeated down
  // every row were the loudest thing on the page.
  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'var(--icon-badge-bg)',
      }}
    >
      <LogoAvatar
        src={`${apiBaseUrl}/crypto/icon/${encodeURIComponent(ticker)}`}
        alt={ticker}
        size={mark}
        imgStyle={{
          borderRadius: '50%',
          display: 'block',
          filter: 'grayscale(1)',
          opacity: 0.7,
        }}
        fallback={<Monogram asset={ticker} size={mark} />}
        fallbackStyle={{ display: 'inline-flex' }}
      />
    </Box>
  );
}

function Monogram({ asset, size }: { asset: string; size: number }): React.JSX.Element {
  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--muted-foreground)',
        fontSize: size * 0.6,
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      {asset.charAt(0)}
    </Box>
  );
}
