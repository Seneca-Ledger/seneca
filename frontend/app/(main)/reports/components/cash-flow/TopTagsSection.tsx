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
import { useTopTagsViewModel } from '@/app/(main)/statements/components/top-tags/hooks/useTopTagsViewModel';

/** Tag names are the user's own words: shown as written, never translated. */
const asWritten = (name: string): string => name;

const TAG_FOCUS_PREFIX = 'tag:';

type Props = {
  /** `?focus=tag:<name>` from a tag in the Documents list rings that tag. */
  focusId: string | null;
};

/** By tag: the category section's sankey, table and drill-down, filed by tag. */
export function TopTagsSection({ focusId }: Props): React.JSX.Element {
  const tagFocus = focusId?.startsWith(TAG_FOCUS_PREFIX) ? focusId : null;
  const { month, changeMonth } = useSectionMonth();
  const vm = useTopTagsViewModel(month);
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
        attentionId={tagFocus}
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
        <TopCategoriesContent
          vm={vm}
          viewMode={viewMode}
          month={month}
          focusId={tagFocus}
          groupBy="tag"
          nameOf={asWritten}
          attentionPrefix={TAG_FOCUS_PREFIX}
        />
      </AnalyticsSection>
      {vm.selectedRow ? (
        <TopCategoriesDrillDown
          selectedRow={vm.selectedRow}
          drillDownRecords={vm.drillDownRecords}
          onClose={() => vm.setSelectedRowId(null)}
          currency={vm.workspaceCurrency}
          sourceLabels={vm.sourceLabels}
          labels={vm.drillLabels}
          nameOf={asWritten}
        />
      ) : null}
    </>
  );
}
