'use client';

import Box from '@mui/material/Box';
import { Suspense } from 'react';
import { NetWorthContent } from './components/NetWorthContent';
import { NetWorthSkeleton } from './components/NetWorthSkeleton';

export default function NetWorthPage() {
  return (
    <Box
      component="main"
      sx={{
        minHeight: 'calc(100vh - var(--global-nav-height,0px))',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* The window lives in the address, and `useSearchParams` needs a
          boundary so the static shell can still prerender. */}
      <Suspense
        fallback={
          <Box sx={{ px: { xs: 2, md: 4 }, pt: 'var(--seneca-page-top, 24px)' }}>
            <NetWorthSkeleton />
          </Box>
        }
      >
        <NetWorthContent />
      </Suspense>
    </Box>
  );
}
