'use client';

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { DashboardCard } from '@/app/components/dashboard/ui';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';

const cardSx = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: tokens.radius.md,
  bgcolor: 'background.paper',
  p: 2.5,
  mt: 3,
} as const;

const titleSx = { fontSize: 15, fontWeight: 500, color: 'var(--foreground)' } as const;

/** The goal's progress header and its flow chart while the flow loads. */
export function GoalFlowSkeleton(): React.JSX.Element {
  const t = useIntlayer('goalDetailPage');
  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
          <Skeleton variant="text" width={220} height={32} />
          <Skeleton variant="text" width={160} height={24} />
        </Box>
        <Skeleton variant="rounded" height={6} sx={{ borderRadius: tokens.radius.full, my: 1.5 }} />
        <Skeleton variant="text" width={200} height={20} />
      </Box>
      <DashboardCard title={t.flowTitle} subtitle={<Skeleton variant="text" width={240} />}>
        <Skeleton variant="rounded" height={440} />
      </DashboardCard>
    </>
  );
}

/** The savings plan card: its title and the four labelled figures. */
export function GoalPlanSkeleton(): React.JSX.Element {
  const t = useIntlayer('goalDetailPage');
  return (
    <Box sx={cardSx}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 2.5 }}>
        <Box>
          <Typography sx={titleSx}>{t.planTitle}</Typography>
          <Skeleton variant="text" width={180} height={20} sx={{ mt: 0.25 }} />
        </Box>
        <Skeleton variant="text" width={80} height={20} />
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          gap: 2.5,
        }}
      >
        {[t.planRequired, t.planPace, t.planForecast, t.planFree].map((label, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed set of figures
          <Box key={index} sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</Typography>
            <Skeleton variant="text" width={110} height={30} sx={{ mt: 0.25 }} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/** The cost lines card: its title and a few line rows. */
export function GoalItemsSkeleton(): React.JSX.Element {
  const t = useIntlayer('goalDetailPage');
  return (
    <Box sx={cardSx}>
      <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 30, mb: 1.5 }}>
        <Typography sx={titleSx}>{t.itemsTitle}</Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {Array.from({ length: 3 }, (_, index) => (
          <Box
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            key={index}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: tokens.radius.md,
              px: 2,
              py: 1.5,
            }}
          >
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width={160} height={20} />
              <Skeleton variant="text" width={70} height={18} />
            </Box>
            <Skeleton variant="text" width={80} height={20} />
            <Skeleton variant="circular" width={30} height={30} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
