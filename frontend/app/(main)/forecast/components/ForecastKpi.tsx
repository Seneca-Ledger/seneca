'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { tokens } from '@/lib/theme-tokens';

/** A forecast card: the frame every block of the page sits in. */
export const FORECAST_CARD_SX = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: tokens.radius.md,
  bgcolor: 'background.paper',
  p: 3,
} as const;

export function Kpi({
  label,
  value,
  note,
  tone,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  note?: React.ReactNode;
  /** Colour only for a real signal: money that runs out, or room to spend. */
  tone?: 'success' | 'error';
}) {
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: tokens.radius.md,
        bgcolor: 'background.paper',
        p: 2,
      }}
    >
      <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{label}</Typography>
      <Typography
        variant="h6"
        sx={{
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',

          color:
            tone === 'success'
              ? 'var(--money-up)'
              : tone === 'error'
                ? 'var(--money-down)'
                : 'text.primary',
        }}
      >
        {value}
      </Typography>
      {note && <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{note}</Typography>}
    </Box>
  );
}
