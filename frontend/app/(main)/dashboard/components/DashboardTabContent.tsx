'use client';

import Box from '@mui/material/Box';
import type React from 'react';
import { DataHealthTab } from '@/app/components/dashboard/DataHealthTab';
import { FinanceOpsTab } from '@/app/components/dashboard/FinanceOpsTab';
import { OverviewTab } from '@/app/components/dashboard/OverviewTab';
import { TrendsTab } from '@/app/components/dashboard/TrendsTab';
import type { DashboardData } from '@/app/hooks/useDashboard';
import type { DashboardTabId } from '../helpers/dashboard-url-state';

type DashboardTabContentProps = {
  activeTab: DashboardTabId;
  data: DashboardData;
  formatAmount: (value: number) => string;
  isLoading: boolean;
  displayMonth: Date;
  /** Switches the dashboard month (0-based `month`), as the header month strip does. */
  onSelectMonth: (year: number, month: number) => void;
};

export function DashboardTabContent({
  activeTab,
  data,
  formatAmount,
  isLoading,
  displayMonth,
  onSelectMonth,
}: DashboardTabContentProps): React.JSX.Element {
  return (
    <Box sx={{ width: '100%', px: { xs: 2, md: 4 }, pt: 2.5, flex: 1, pb: 6 }}>
      {activeTab === 'finance-ops' && (
        <FinanceOpsTab data={data} formatAmount={formatAmount} displayMonth={displayMonth} />
      )}
      {activeTab === 'overview' && (
        <OverviewTab
          data={data}
          formatAmount={formatAmount}
          isLoading={isLoading}
          displayMonth={displayMonth}
        />
      )}
      {activeTab === 'trends' && (
        <TrendsTab
          formatAmount={formatAmount}
          displayMonth={displayMonth}
          onSelectMonth={onSelectMonth}
        />
      )}
      {activeTab === 'data-health' && (
        <DataHealthTab
          data={data}
          formatAmount={formatAmount}
          displayMonth={displayMonth}
          onSelectMonth={onSelectMonth}
        />
      )}
    </Box>
  );
}
