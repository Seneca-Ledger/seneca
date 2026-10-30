'use client';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { tokens } from '@/lib/theme-tokens';

const SCHEDULE_SKELETON_KEYS = ['schedule-0', 'schedule-1'];

/** A schedule's row: what is sent and to whom, then the switch and delete. */
export const SCHEDULE_ROW_SX = {
  borderRadius: tokens.radius.md,
  border: '1px solid var(--border)',
  bgcolor: 'var(--card)',
  p: 2,
  mb: 1.5,
  display: 'flex',
  alignItems: 'center',
  gap: 2,
} as const;

/** The schedules while they load: their rows as bars, the switch and delete in place. */
export function ScheduleRowsSkeleton(): React.JSX.Element {
  return (
    <Box aria-busy>
      {SCHEDULE_SKELETON_KEYS.map(key => (
        <Paper key={key} elevation={0} sx={SCHEDULE_ROW_SX}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="body2">
              <Skeleton variant="text" width="40%" />
            </Typography>
            <Typography variant="caption" component="div">
              <Skeleton variant="text" width="55%" />
            </Typography>
          </Box>
          <Skeleton variant="rounded" width={40} height={24} sx={{ borderRadius: 999 }} />
          <Skeleton variant="circular" width={26} height={26} />
        </Paper>
      ))}
    </Box>
  );
}
