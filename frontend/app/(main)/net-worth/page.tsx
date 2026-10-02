'use client';

import Box from '@mui/material/Box';
import { Suspense } from 'react';
import { Spinner } from '@/app/components/ui/spinner';
import { NetWorthContent } from './components/NetWorthContent';

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
      <Suspense fallback={<Spinner size={40} />}>
        <NetWorthContent />
      </Suspense>
    </Box>
  );
}
