import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import type React from 'react';

/** Mirrors the tab strip + content column so the real page lands without a layout shift. */
export function SettingsSkeleton(): React.JSX.Element {
  return (
    <Box className="container-shared" sx={{ px: 2, py: 4 }}>
      <Box sx={{ maxWidth: 800, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', gap: 1, overflow: 'hidden' }}>
          {Array.from({ length: 6 }).map((_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length static skeleton list
            <Skeleton key={index} variant="rounded" width={104} height={36} />
          ))}
        </Box>
        <Skeleton variant="text" width={160} height={36} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Skeleton variant="circular" width={64} height={64} />
          <Skeleton variant="text" width={200} height={28} />
        </Box>
        {Array.from({ length: 3 }).map((_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length static skeleton list
          <Skeleton key={index} variant="rounded" width="100%" height={56} />
        ))}
      </Box>
    </Box>
  );
}
