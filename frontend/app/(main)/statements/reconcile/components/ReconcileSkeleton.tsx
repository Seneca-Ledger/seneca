'use client';

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { useIntlayer } from '@/app/i18n';

const ROW_KEYS = ['a', 'b', 'c'];
const LINE_KEYS = ['a', 'b', 'c', 'd'];

/**
 * The reconciliation cards while they load: the same cards with their titles
 * and the ageing table's head, placeholders where the pairs and figures go.
 */
export function ReconcileSkeleton({
  card,
  buckets,
}: {
  card: Record<string, unknown>;
  buckets: ReadonlyArray<{ key: string; label: string }>;
}): React.JSX.Element {
  const t = useIntlayer('reconcilePage');
  const title = (text: React.ReactNode) => (
    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
      {text}
    </Typography>
  );
  return (
    <Box aria-busy="true" sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 3 }}>
      <Box sx={card}>
        {title(t.matches)}
        <Box sx={{ display: 'grid', gap: 1 }}>
          {ROW_KEYS.map(key => (
            <Box
              key={key}
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'minmax(0, 1fr)',
                  md: 'minmax(0, 1fr) minmax(0, 1fr) auto',
                },
                gap: 1.5,
                alignItems: 'center',
                py: 1,
                borderTop: 1,
                borderColor: 'divider',
              }}
            >
              <Box>
                <Skeleton variant="text" width="45%" />
                <Skeleton variant="text" width="65%" height={16} />
              </Box>
              <Box>
                <Skeleton variant="text" width="50%" />
                <Skeleton variant="text" width="40%" height={16} />
              </Box>
              <Skeleton variant="rounded" width={80} height={30} />
            </Box>
          ))}
        </Box>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
          gap: 3,
        }}
      >
        <Box sx={card}>
          {title(t.ageing)}
          <Box sx={{ overflowX: 'auto' }}>
            <Box
              component="table"
              sx={{
                width: '100%',
                borderCollapse: 'collapse',
                '& th, & td': { pr: 1.5, whiteSpace: 'nowrap' },
                '& th': { textAlign: 'left', py: 0.5, color: 'text.secondary', fontSize: 12 },
                '& td': { py: 0.75, borderTop: 1, borderColor: 'divider', fontSize: 14 },
              }}
            >
              <thead>
                <tr>
                  <th />
                  {buckets.map(bucket => (
                    <th key={bucket.key}>{t[bucket.label as 'bucketCurrent']}</th>
                  ))}
                  <th>{t.total}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{t.payables}</td>
                  {[...buckets, { key: 'total' }].map(bucket => (
                    <td key={bucket.key}>
                      <Skeleton variant="text" width={44} />
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>{t.receivables}</td>
                  {[...buckets, { key: 'total' }].map(bucket => (
                    <td key={bucket.key}>
                      <Skeleton variant="text" width={44} />
                    </td>
                  ))}
                </tr>
              </tbody>
            </Box>
          </Box>
        </Box>
        <Box sx={card}>
          {title(t.unmatched)}
          <Skeleton variant="text" width={140} height={16} sx={{ mb: 1 }} />
          <Box sx={{ display: 'grid', gap: 0.5 }}>
            {LINE_KEYS.map(key => (
              <Skeleton key={key} variant="text" width="60%" />
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
