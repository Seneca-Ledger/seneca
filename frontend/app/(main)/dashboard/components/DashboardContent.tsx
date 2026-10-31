'use client';

import Box from '@mui/material/Box';
import type React from 'react';
import { OverviewTab } from '@/app/components/dashboard/OverviewTab';
import { useOverviewLayoutState } from '@/app/components/dashboard/use-overview-layout-state';
import { AlertBanner } from '@/app/components/insights/AlertBanner';
import { SnapshotSkeleton } from '@/app/components/ui/snapshot-skeleton/SnapshotSkeleton';
import type { DashboardData } from '@/app/hooks/useDashboard';
import { DashboardErrorBanner } from './DashboardErrorBanner';
import { DashboardHeader } from './DashboardHeader';
import { MissingRatesBanner } from './MissingRatesBanner';

/** Before the header and month are known, the whole page is remembered under this id. */
export const DASHBOARD_SKELETON_ID = 'dashboard';
/** Under the header, which draws for real while the month loads, only the overview is. */
const OVERVIEW_SKELETON_ID = 'dashboard-overview';

const BODY_SX = { width: '100%', px: { xs: 2, md: 4 }, pt: 2.5, flex: 1, pb: 6 };

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
  // Drawn only once the arrangement is known, so it never shows the default first.
  const layoutPending = useOverviewLayoutState().state === undefined;
  if (error) {
    return <DashboardErrorBanner error={error} onRefresh={onRefresh} />;
  }
  const header = (
    <DashboardHeader
      displayMonth={displayMonth}
      changeMonth={changeMonth}
      locale={locale}
      periodBanner={periodBanner}
      labels={headerLabels}
    />
  );
  // Ошибка уже обработана выше, поэтому "не грузится / нет данных" — не пустой
  // экран, а заголовок с месяцами и скелетон обзора под ним.
  if (loading || !data || layoutPending) {
    return (
      <div className="seneca-dashboard__content">
        {header}
        <Box sx={BODY_SX}>
          <SnapshotSkeleton id={OVERVIEW_SKELETON_ID} loading fallback="cards" />
        </Box>
      </div>
    );
  }
  return (
    <div className="seneca-dashboard__content">
      {header}
      <MissingRatesBanner currencies={data.snapshot?.missingRates ?? []} />
      <div className="seneca-dashboard__attention">
        <AlertBanner placement="page" />
      </div>
      <Box sx={BODY_SX}>
        <SnapshotSkeleton id={OVERVIEW_SKELETON_ID} loading={false}>
          <OverviewTab
            data={data}
            formatAmount={formatAmount}
            isLoading={loading}
            displayMonth={displayMonth}
          />
        </SnapshotSkeleton>
      </Box>
    </div>
  );
}
