'use client';

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import type React from 'react';
import { tokens } from '@/lib/theme-tokens';

/** A goal card while it loads; `actions` and `note` are the slots the loaded card fills too. */
export function GoalCardSkeleton({
  actions,
  note = false,
}: {
  actions?: React.ReactNode;
  /** Leaves room for the line a card shows under its progress, e.g. on the dashboard. */
  note?: boolean;
}): React.JSX.Element {
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: tokens.radius.md,
        bgcolor: 'background.paper',
        p: 2.5,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Skeleton variant="rectangular" width={56} height={56} className="seneca-goal-cover" />
          <Box sx={{ minWidth: 0 }}>
            <Skeleton variant="text" width={140} height={24} />
            <Skeleton variant="text" width={80} height={20} />
          </Box>
        </Box>
        <Skeleton variant="text" width={150} height={24} />
      </Box>
      <Skeleton variant="rounded" height={8} sx={{ borderRadius: tokens.radius.full, my: 1.5 }} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
        <Box>
          <Skeleton variant="text" width={160} height={20} />
          {note && <Skeleton variant="text" width={140} height={20} />}
        </Box>
        {actions && <Box sx={{ display: 'flex', gap: 1 }}>{actions}</Box>}
      </Box>
    </Box>
  );
}
