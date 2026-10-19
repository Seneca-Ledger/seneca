'use client';

import Skeleton from '@mui/material/Skeleton';
import dynamic from 'next/dynamic';

function MapSkeleton(): React.JSX.Element {
  return <Skeleton variant="rectangular" width="100%" height="100%" />;
}

/**
 * Leaflet touches `window` on import, so the map is client-only and ships as its
 * own chunk. The skeleton fills the same box, keeping the section height stable.
 */
export const LazyReceiptLocationMap = dynamic(
  () => import('./ReceiptLocationMap').then(module => module.ReceiptLocationMap),
  { ssr: false, loading: MapSkeleton },
);
