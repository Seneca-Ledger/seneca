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
import { TopCategoriesContent } from '@/app/(main)/statements/components/top-categories/components/TopCategoriesContent';
import { TopCategoriesDrillDown } from '@/app/(main)/statements/components/top-categories/components/TopCategoriesDrillDown';
import { useTopCategoriesViewModel } from '@/app/(main)/statements/components/top-categories/hooks/useTopCategoriesViewModel';

type Props = {
  /** The row an advice link rings; it must survive the leaderboard cut-off. */
  focusId: string | null;
};

export function TopCategoriesSection({ focusId }: Props): React.JSX.Element {
  const { month, changeMonth } = useSectionMonth();
  const vm = useTopCategoriesViewModel(month);
  // The ring waits for its row regardless of view, so a deep link opens on the chart;
  // switching to the table later is what reveals the highlighted row.
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
        attentionId={focusId?.startsWith('category:') ? focusId : null}
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
        <TopCategoriesContent vm={vm} focusId={focusId} viewMode={viewMode} month={month} />
      </AnalyticsSection>
      {vm.selectedRow ? (
        <TopCategoriesDrillDown
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
