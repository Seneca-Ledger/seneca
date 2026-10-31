'use client';

import { Box, Card, CardContent, IconButton, Skeleton } from '@mui/material';
import { Pencil, Trash2 } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';

/** Column shares of the loaded table with a few rows in it, so nothing moves when they land. */
const COLUMN_WIDTHS = ['32%', '11%', '14%', '15%', '7.5%', '9%', undefined];

function SubscriptionRowSkeleton(): React.JSX.Element {
  return (
    <tr>
      <td>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Skeleton variant="circular" width={24} height={24} />
          <Box>
            <Skeleton variant="text" width={150} height={24} />
            <Skeleton variant="text" width={50} height={20} />
          </Box>
        </Box>
      </td>
      <td>
        <Skeleton variant="text" width={60} height={20} />
      </td>
      <td>
        <Skeleton variant="text" width={50} height={20} />
      </td>
      <td>
        <Skeleton variant="text" width={80} height={20} />
      </td>
      <td>
        <Skeleton variant="text" width={20} height={20} />
      </td>
      <td>
        <Skeleton variant="text" width={20} height={20} />
      </td>
      <td>
        <IconButton size="small" disabled>
          <Pencil size={16} />
        </IconButton>
        <IconButton size="small" disabled>
          <Trash2 size={16} />
        </IconButton>
      </td>
    </tr>
  );
}

function SubscriptionCardSkeleton(): React.JSX.Element {
  return (
    <Card variant="outlined">
      <CardContent sx={{ pb: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box
          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}
        >
          <Box>
            <Skeleton variant="text" width={120} height={22} />
            <Skeleton variant="text" width={90} height={26} />
          </Box>
          <Skeleton variant="rounded" width={60} height={22} />
        </Box>
        <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
          <Skeleton variant="text" width={80} height={18} />
          <Skeleton variant="text" width={70} height={18} />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Skeleton variant="circular" width={28} height={28} />
          <Skeleton variant="circular" width={28} height={28} />
        </Box>
      </CardContent>
    </Card>
  );
}

/** The subscriptions list while it loads: the table on a desktop, cards on a phone. */
export function SubscriptionsListSkeleton(): React.JSX.Element {
  const t = useIntlayer('subscriptionsPage');
  const headers = [
    t.colVendor,
    t.colSpend,
    t.colNextCharge,
    t.colOwner,
    t.colRisk,
    t.colReview,
    null,
  ];
  return (
    <>
      <Box
        sx={{
          display: { xs: 'none', md: 'block' },
          overflowX: 'auto',
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
          // A CSS variable, not the theme colour: it turns translucent over a content background.
          bgcolor: 'var(--card-bg)',
        }}
      >
        <Box
          component="table"
          sx={{
            width: '100%',
            borderCollapse: 'collapse',
            '& th': { textAlign: 'left', p: 1.5, color: 'text.secondary', fontSize: 12 },
            '& td': { p: 1.5, borderTop: 1, borderColor: 'divider' },
          }}
        >
          <thead>
            <tr>
              {headers.map((label, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed columns
                <th key={index} style={{ width: COLUMN_WIDTHS[index] }}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
              <SubscriptionRowSkeleton key={index} />
            ))}
          </tbody>
        </Box>
      </Box>
      <Box sx={{ display: { xs: 'grid', md: 'none' }, gridTemplateColumns: '1fr', gap: 1.5 }}>
        {Array.from({ length: 4 }).map((_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <SubscriptionCardSkeleton key={index} />
        ))}
      </Box>
    </>
  );
}
