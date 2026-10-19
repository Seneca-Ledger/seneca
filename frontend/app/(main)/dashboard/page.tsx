'use client';

import Box from '@mui/material/Box';
import type React from 'react';
import { Suspense } from 'react';
import { Spinner } from '@/app/components/ui/spinner';
import { useAttentionFocus } from '@/app/hooks/useAttentionFocus';
import { DashboardContent } from './components/DashboardContent';
import { DashboardPullIndicator } from './components/DashboardPullIndicator';
import { useDashboardPage } from './hooks/useDashboardPage';

const REDIRECTING_SX = {
  display: 'flex',
  minHeight: 'calc(100vh - var(--global-nav-height,0px))',
  alignItems: 'center',
  justifyContent: 'center',
};
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
    activeTab,
    setActiveTab,
    refetch,
    formatAmount,
    periodBanner,
    displayMonth,
    changeMonth,
    locale,
    headerLabels,
    t,
  } = useDashboardPage();

  if (isRedirecting) {
    return (
      <Box sx={REDIRECTING_SX}>
        <Spinner size={40} />
      </Box>
    );
  }

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
        <DashboardContent
          error={error}
          loading={isPending}
          data={data ?? null}
          onRefresh={() => {
            void refetch();
          }}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
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
    <Suspense
      fallback={
        <Box sx={REDIRECTING_SX}>
          <Spinner size={40} />
        </Box>
      }
    >
      <DashboardPageInner />
    </Suspense>
  );
}
