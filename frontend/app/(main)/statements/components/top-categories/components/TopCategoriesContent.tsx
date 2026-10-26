'use client';

import { AnalyticsFlowSection } from '@/app/(main)/statements/components/analytics/flow/AnalyticsFlowSection';
import type { AnalyticsViewMode } from '@/app/(main)/statements/components/analytics/flow/analytics-flow.types';
import type { SpendFlowGroupBy } from '@/app/(main)/statements/components/analytics/flow/useSpendFlow';
import { TopCategoriesLeaderboard } from '@/app/(main)/statements/components/top-categories/components/TopCategoriesLeaderboard';
import { TopCategoriesStatCards } from '@/app/(main)/statements/components/top-categories/components/TopCategoriesStatCards';
import type { useTopCategoriesViewModel } from '@/app/(main)/statements/components/top-categories/hooks/useTopCategoriesViewModel';
import type { CategorySortKey } from '@/app/(main)/statements/components/top-categories.utils';

type Props = {
  vm: ReturnType<typeof useTopCategoriesViewModel>;
  focusId?: string | null;
  /** Rows that are not categories (tags) name themselves and answer their own `?focus=`. */
  nameOf?: (name: string) => string;
  attentionPrefix?: string;
};

function TopCategoriesLeaderboardSection({
  vm,
  focusId,
  nameOf,
  attentionPrefix,
}: Props): React.JSX.Element {
  const isIncomeView = vm.activeFlowType === 'income';
  const { labels, workspaceCurrency } = vm;
  const sourceLabels = {
    sourceBank: labels.sourceBank,
    sourceReceipt: labels.sourceReceipt,
    sourceCrypto: labels.sourceCrypto,
  };
  const columnLabels = {
    category: labels.category,
    source: labels.source,
    operations: labels.operations,
    average: labels.average,
    amount: labels.amount,
    lastOperation: labels.lastOperation,
  };
  const sortLabels = {
    sortByAmount: labels.sortByAmount,
    sortByAverage: labels.sortByAverage,
    sortByOperations: labels.sortByOperations,
  };
  return (
    <TopCategoriesLeaderboard
      rows={vm.sortedAggregatedRows}
      sortKey={vm.sortKey as CategorySortKey}
      onSortChange={vm.setSortKey}
      onRowClick={vm.setSelectedRowId}
      title={isIncomeView ? labels.incomeLeaderboard : labels.leaderboard}
      currency={workspaceCurrency}
      sourceLabels={sourceLabels}
      sortLabels={sortLabels}
      columnLabels={columnLabels}
      emptyLabel={labels.comparisonNoData}
      focusId={focusId}
      nameOf={nameOf}
      attentionPrefix={attentionPrefix}
    />
  );
}

function TopCategoriesNumbers({
  vm,
  focusId = null,
  nameOf,
  attentionPrefix,
}: Props): React.JSX.Element {
  const isIncomeView = vm.activeFlowType === 'income';
  const { labels, workspaceCurrency } = vm;
  return (
    <>
      <TopCategoriesStatCards
        totals={vm.totals}
        comparison={vm.comparison}
        isIncomeView={isIncomeView}
        primaryMetricLabel={isIncomeView ? labels.totalIncome : labels.totalSpend}
        statementsLabel={labels.statementsSpend}
        receiptsLabel={labels.receiptsSpend}
        operationsLabel={labels.totalOperations}
        currency={workspaceCurrency}
        noDataLabel={labels.comparisonNoData}
        vsPreviousPeriodLabel={labels.vsPreviousPeriod}
      />
      <TopCategoriesLeaderboardSection
        vm={vm}
        focusId={focusId}
        nameOf={nameOf}
        attentionPrefix={attentionPrefix}
      />
    </>
  );
}

/**
 * The row a `?focus=` deep link names (`category:<name>`, or the section's own
 * prefix), for the chart to blink. A reader who switched to chart mode gets the
 * same answer the ringed leaderboard row gives them in table mode.
 */
const focusedNodeName = (focusId: string | null, prefix: string): string | null =>
  focusId?.startsWith(prefix) ? focusId.slice(prefix.length) : null;

/**
 * Chart mode is the illustration alone; table mode holds every figure (cards
 * and leaderboard), which is also where advice links ring a row.
 */
export function TopCategoriesContent({
  vm,
  focusId = null,
  viewMode,
  month,
  groupBy = 'category-subcategory',
  nameOf,
  attentionPrefix,
}: Props & {
  viewMode: AnalyticsViewMode;
  month: Date;
  groupBy?: SpendFlowGroupBy;
}): React.JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 24 }}>
      {viewMode === 'chart' ? (
        <AnalyticsFlowSection
          groupBy={groupBy}
          flowType={vm.activeFlowType}
          month={month}
          resolvedTheme={vm.resolvedTheme}
          labels={vm.labels}
          flashNodeName={focusedNodeName(focusId, attentionPrefix ?? 'category:')}
        />
      ) : (
        <TopCategoriesNumbers
          vm={vm}
          focusId={focusId}
          nameOf={nameOf}
          attentionPrefix={attentionPrefix}
        />
      )}
    </div>
  );
}
