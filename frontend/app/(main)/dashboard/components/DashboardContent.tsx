'use client';

import Box from '@mui/material/Box';
import type React from 'react';
import { OverviewTab } from '@/app/components/dashboard/OverviewTab';
import { AlertBanner } from '@/app/components/insights/AlertBanner';
import { SnapshotSkeleton } from '@/app/components/ui/snapshot-skeleton/SnapshotSkeleton';
import type { DashboardData } from '@/app/hooks/useDashboard';
import { DashboardErrorBanner } from './DashboardErrorBanner';
import { DashboardHeader } from './DashboardHeader';
import { MissingRatesBanner } from './MissingRatesBanner';

/** The dashboard remembers its layout under one id, from every loading state. */
export const DASHBOARD_SKELETON_ID = 'dashboard';

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
    return <SnapshotSkeleton id={DASHBOARD_SKELETON_ID} loading />;
  }
  return (
    <SnapshotSkeleton
      id={DASHBOARD_SKELETON_ID}
      loading={false}
      className="seneca-dashboard__content"
    >
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
        />
      </Box>
    </SnapshotSkeleton>
  );
}
