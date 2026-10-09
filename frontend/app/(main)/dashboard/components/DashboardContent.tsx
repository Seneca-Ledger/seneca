'use client';

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import type React from 'react';
import { UnconfirmedNotice } from '@/app/components/review/UnconfirmedNotice';
import type { DashboardData } from '@/app/hooks/useDashboard';
import type { DashboardTabId } from '../helpers/dashboard-url-state';
import { DashboardErrorBanner } from './DashboardErrorBanner';
import { DashboardHeader } from './DashboardHeader';
import { DashboardTabContent } from './DashboardTabContent';
import { MissingRatesBanner } from './MissingRatesBanner';

function DashboardStatCardSkeleton(): React.JSX.Element {
  return (
    <Box sx={{ flex: 1, minWidth: 180, p: 2 }}>
      <Skeleton variant="text" width="50%" height={16} />
      <Skeleton variant="text" width="70%" height={32} />
      <Skeleton variant="text" width="40%" height={14} />
    </Box>
  );
}

function DashboardContentSkeleton(): React.JSX.Element {
  return (
    <Box sx={{ px: { xs: 2, md: 4 }, pt: 4, pb: 6 }}>
      {/* Tabs / status heading */}
      <Skeleton variant="text" width={220} height={32} sx={{ mb: 3 }} />

      {/* Stat card row */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <DashboardStatCardSkeleton />
        <DashboardStatCardSkeleton />
        <DashboardStatCardSkeleton />
        <DashboardStatCardSkeleton />
      </Box>

      {/* Cash flow chart + top categories row */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box sx={{ flex: '2 1 480px', p: 2 }}>
          <Skeleton variant="text" width="30%" height={20} sx={{ mb: 1 }} />
          <Skeleton variant="rounded" width="100%" height={220} />
        </Box>
        <Box sx={{ flex: '1 1 260px', p: 2 }}>
          <Skeleton variant="text" width="50%" height={20} sx={{ mb: 1 }} />
          <Skeleton variant="rounded" width="100%" height={220} />
        </Box>
      </Box>

      {/* Recent transactions list */}
      <Box sx={{ p: 2 }}>
        <Skeleton variant="text" width="25%" height={20} sx={{ mb: 1 }} />
        {[0, 1, 2, 3, 4].map(i => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5 }}>
            <Skeleton variant="rounded" width={32} height={32} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="40%" height={16} />
              <Skeleton variant="text" width="25%" height={14} />
            </Box>
            <Skeleton variant="text" width={70} height={16} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

type DashboardContentProps = {
  error: string | null;
  loading: boolean;
  data: DashboardData | null;
  onRefresh: () => void;
  activeTab: DashboardTabId;
  setActiveTab: (tab: DashboardTabId) => void;
  formatAmount: (value: number) => string;
  periodBanner: string | null;
  displayMonth: Date;
  changeMonth: (year: number, month: number) => void;
  locale: string;
  headerLabels: React.ComponentProps<typeof DashboardHeader>['labels'];
};

export function DashboardContent({
  error,
  loading,
  data,
  onRefresh,
  activeTab,
  setActiveTab,
  formatAmount,
  periodBanner,
  displayMonth,
  changeMonth,
  locale,
  headerLabels,
}: DashboardContentProps): React.JSX.Element {
  if (error) {
    return <DashboardErrorBanner error={error} onRefresh={onRefresh} />;
  }
  // Ошибка уже обработана выше, поэтому "не грузится / нет данных" — не пустой
  // экран, а всё тот же скелетон.
  if (loading || !data) {
    return <DashboardContentSkeleton />;
  }
  return (
    <>
      <DashboardHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        displayMonth={displayMonth}
        changeMonth={changeMonth}
        locale={locale}
        periodBanner={periodBanner}
        labels={headerLabels}
      />
      <MissingRatesBanner currencies={data.snapshot?.missingRates ?? []} />
      <UnconfirmedNotice style={{ margin: '0 16px 12px' }} />
      <DashboardTabContent
        activeTab={activeTab}
        data={data}
        formatAmount={formatAmount}
        isLoading={loading}
        displayMonth={displayMonth}
        onSelectMonth={changeMonth}
      />
    </>
  );
}
