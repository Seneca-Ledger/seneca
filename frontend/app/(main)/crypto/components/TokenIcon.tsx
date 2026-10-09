'use client';

import Box from '@mui/material/Box';
import type React from 'react';
import { LogoAvatar } from '@/app/components/LogoAvatar';
import { apiBaseUrl } from '@/app/lib/api';

/**
 * Brand colour of the assets we price, for the monogram that stands in while the
 * logo loads or when there is none to load.
 */
const TOKEN_COLORS: Record<string, string> = {
  ETH: '#627eea',
  WETH: '#627eea',
  USDT: '#26a17b',
  USDC: '#2775ca',
  DAI: '#f5ac37',
  WBTC: '#f09242',
  LINK: '#2a5ada',
  UNI: '#ff007a',
  AAVE: '#b6509e',
  MATIC: '#8247e5',
  OP: '#ff0420',
  TRX: '#eb0029',
  POL: '#8247e5',
  ARB: '#28a0f0',
  BTC: '#f7931a',
  SOL: '#9945ff',
};

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

  return (
    <LogoAvatar
      src={`${apiBaseUrl}/crypto/icon/${encodeURIComponent(ticker)}`}
      alt={ticker}
      size={size}
      imgStyle={{ borderRadius: '50%', display: 'block' }}
      fallback={<Monogram asset={ticker} size={size} />}
      fallbackStyle={{ display: 'inline-flex' }}
    />
  );
}

function Monogram({ asset, size }: { asset: string; size: number }): React.JSX.Element {
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
        bgcolor: TOKEN_COLORS[asset] ?? 'text.disabled',
        color: '#fff',
        fontSize: size * 0.42,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {asset.charAt(0)}
    </Box>
  );
}
