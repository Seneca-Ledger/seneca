'use client';

import Box from '@mui/material/Box';
import type React from 'react';
import { Suspense } from 'react';
import { SnapshotSkeleton } from '@/app/components/ui/snapshot-skeleton/SnapshotSkeleton';
import { useAttentionFocus } from '@/app/hooks/useAttentionFocus';
import { DASHBOARD_SKELETON_ID, DashboardContent } from './components/DashboardContent';
import { DashboardPullIndicator } from './components/DashboardPullIndicator';
import { useDashboardPage } from './hooks/useDashboardPage';

const MAIN_SX = {
  minHeight: 'calc(100vh - var(--global-nav-height,0px))',
  display: 'flex',
  flexDirection: 'column',
};

function DashboardPageInner(): React.JSX.Element {
  useAttentionFocus();
  const {
    isRedirecting,
    isMobile,
    pullHandlers,
    pullDistance,
    pullRefreshing,
    isReadyToRefresh,
    error,
    isPending,
    data,
    refetch,
    formatAmount,
    periodBanner,
    displayMonth,
    changeMonth,
    locale,
    headerLabels,
    t,
  } = useDashboardPage();

  return (
    <Box component="main" sx={MAIN_SX} {...pullHandlers}>
      <Box sx={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <DashboardPullIndicator
          isMobile={isMobile}
          pullDistance={pullDistance}
          pullRefreshing={pullRefreshing}
          isReadyToRefresh={isReadyToRefresh}
          t={t.refresh}
        />
        {/* While the session and workspace settle, the header already draws. */}
        <DashboardContent
          error={isRedirecting ? null : error}
          loading={isRedirecting || isPending}
          data={data ?? null}
          onRefresh={() => {
            void refetch();
          }}
          formatAmount={formatAmount}
          periodBanner={periodBanner}
          displayMonth={displayMonth}
          changeMonth={changeMonth}
          locale={locale}
          headerLabels={headerLabels}
        />
      </Box>
    </Box>
  );
}

/** `useSearchParams` needs a Suspense boundary so the static shell can prerender. */
export default function DashboardPage(): React.JSX.Element {
  return (
    <Suspense fallback={<SnapshotSkeleton id={DASHBOARD_SKELETON_ID} loading />}>
      <DashboardPageInner />
    </Suspense>
  );
}
