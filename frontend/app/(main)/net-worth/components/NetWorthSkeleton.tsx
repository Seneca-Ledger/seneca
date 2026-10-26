'use client';

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import type React from 'react';
import { tokens } from '@/lib/theme-tokens';

export function NetWorthSkeleton(): React.JSX.Element {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: tokens.radius.md,
          bgcolor: 'background.paper',
          p: 3,
        }}
      >
        <Skeleton variant="text" width={220} height={44} />
        <Skeleton variant="text" width={160} height={20} sx={{ mt: 1 }} />
        <Skeleton variant="rounded" height={220} sx={{ mt: 2, borderRadius: tokens.radius.md }} />
        <Box sx={{ display: 'flex', gap: 4, mt: 2, flexWrap: 'wrap' }}>
          <Box>
            <Skeleton variant="text" width={60} height={16} />
            <Skeleton variant="text" width={100} height={22} />
          </Box>
          <Box>
            <Skeleton variant="text" width={80} height={16} />
            <Skeleton variant="text" width={100} height={22} />
          </Box>
        </Box>
      </Box>
      <Skeleton variant="rounded" height={140} sx={{ borderRadius: tokens.radius.md }} />
      <Skeleton variant="rounded" height={200} sx={{ borderRadius: tokens.radius.md }} />
    </Box>
  );
}
