'use client';

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import type React from 'react';
import { OverviewTab } from '@/app/components/dashboard/OverviewTab';
import { AlertBanner } from '@/app/components/insights/AlertBanner';
import type { DashboardData } from '@/app/hooks/useDashboard';
import { DashboardErrorBanner } from './DashboardErrorBanner';
import { DashboardHeader } from './DashboardHeader';
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
      {/* Month strip */}
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
        displayMonth={displayMonth}
        changeMonth={changeMonth}
        locale={locale}
        periodBanner={periodBanner}
        labels={headerLabels}
      />
      <MissingRatesBanner currencies={data.snapshot?.missingRates ?? []} />
      <div className="seneca-dashboard__attention">
        <AlertBanner placement="page" />
      </div>
      <Box sx={{ width: '100%', px: { xs: 2, md: 4 }, pt: 2.5, flex: 1, pb: 6 }}>
        <OverviewTab
          data={data}
          formatAmount={formatAmount}
          isLoading={loading}
          displayMonth={displayMonth}
          onSelectMonth={changeMonth}
        />
      </Box>
    </>
  );
}
