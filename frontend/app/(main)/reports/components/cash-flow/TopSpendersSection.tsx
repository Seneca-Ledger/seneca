'use client';

import type React from 'react';
import { useState } from 'react';
import { AnalyticsSection } from '@/app/(main)/reports/components/cash-flow/AnalyticsSection';
import { useSectionMonth } from '@/app/(main)/reports/components/cash-flow/useSectionMonth';
import { AnalyticsFlowHeader } from '@/app/(main)/statements/components/analytics/flow/AnalyticsFlowHeader';
import type {
  AnalyticsFlowHeaderLabels,
  AnalyticsViewMode,
} from '@/app/(main)/statements/components/analytics/flow/analytics-flow.types';
import { TopSpendersContent } from '@/app/(main)/statements/components/top-spenders/components/TopSpendersContent';
import { TopSpendersDrillDown } from '@/app/(main)/statements/components/top-spenders/components/TopSpendersDrillDown';
import { useTopSpendersViewModel } from '@/app/(main)/statements/components/top-spenders/hooks/useTopSpendersViewModel';

export function TopSpendersSection(): React.JSX.Element {
  const { month, changeMonth } = useSectionMonth();
  const vm = useTopSpendersViewModel(month);
  const [viewMode, setViewMode] = useState<AnalyticsViewMode>('chart');

  return (
    <>
      <AnalyticsSection
        title={vm.labels.title}
        header={
          <AnalyticsFlowHeader
            labels={vm.labels as AnalyticsFlowHeaderLabels}
            flowType={vm.activeFlowType}
            onFlowTypeChange={vm.setActiveFlowType}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            month={month}
            onMonthChange={changeMonth}
          />
        }
        viewMode={viewMode}
        loading={vm.loading}
        isEmpty={vm.flowFilteredRecords.length === 0}
        isIncome={vm.activeFlowType === 'income'}
        month={month}
        emptyLabels={{
          emptyMonthSpend: vm.labels.emptyMonthSpend,
          emptyMonthIncome: vm.labels.emptyMonthIncome,
          emptyMonthHint: vm.labels.emptyMonthHint,
        }}
      >
        <TopSpendersContent vm={vm} viewMode={viewMode} month={month} />
      </AnalyticsSection>
      {vm.selectedRow ? (
        <TopSpendersDrillDown
          selectedRow={vm.selectedRow}
          drillDownRecords={vm.drillDownRecords}
          onClose={() => vm.setSelectedRowId(null)}
          currency={vm.workspaceCurrency}
          sourceLabels={vm.sourceLabels}
          labels={vm.drillLabels}
        />
      ) : null}
    </>
  );
}
