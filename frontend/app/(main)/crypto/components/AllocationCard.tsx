'use client';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import type React from 'react';
import type { CryptoHolding } from '../hooks/useCrypto';
import { TokenIcon } from './TokenIcon';

type AllocationCardProps = {
  holdings: CryptoHolding[];
  money: (value: number) => string;
  title: string;
};

/**
 * Which coin the portfolio is leaning on. Bars rather than a pie: the question is
 * "how much of it is one asset", which a length answers better than an angle.
 *
 * The rail is drawn by hand instead of with a progress bar, whose track reads as
 * a full bar in this theme — a one per cent holding looked like the whole thing.
 */
export function AllocationCard({ holdings, money, title }: AllocationCardProps): React.JSX.Element {
  const total = holdings.reduce((sum, holding) => sum + holding.value, 0);

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
        {title}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
        {holdings.map(holding => {
          const percent = total > 0 ? (holding.value / total) * 100 : 0;
          const share = percent > 0 ? Math.max(Math.min(percent, 100), 1.5) : 0;
          return (
            <Box key={holding.asset}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TokenIcon asset={holding.asset} size={18} />
                  <Typography variant="body2" fontWeight={600}>
                    {holding.asset}
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {percent < 1 && percent > 0 ? '<1' : Math.round(percent)}% ·{' '}
                  {money(holding.value)}
                </Typography>
              </Box>
              <Box
                sx={{
                  mt: 0.75,
                  height: 4,
                  borderRadius: 2,
                  bgcolor: 'action.hover',
                  overflow: 'hidden',
                }}
              >
                <Box
                  data-share={share.toFixed(2)}
                  sx={{
                    // A holding that exists is drawn, however small: a bar of zero
                    // width would say the coin is not there at all.
                    width: `${share}%`,
                    height: '100%',
                    borderRadius: 2,
                    bgcolor: 'var(--ff-dash-success)',
                  }}
                />
              </Box>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}
