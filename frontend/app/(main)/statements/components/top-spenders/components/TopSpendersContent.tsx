'use client';

import { AnalyticsFlowSection } from '@/app/(main)/statements/components/analytics/flow/AnalyticsFlowSection';
import type { AnalyticsViewMode } from '@/app/(main)/statements/components/analytics/flow/analytics-flow.types';
import { TopSpendersLeaderboard } from '@/app/(main)/statements/components/top-spenders/components/TopSpendersLeaderboard';
import { TopSpendersStatCards } from '@/app/(main)/statements/components/top-spenders/components/TopSpendersStatCards';
import type { useTopSpendersViewModel } from '@/app/(main)/statements/components/top-spenders/hooks/useTopSpendersViewModel';

type Props = { vm: ReturnType<typeof useTopSpendersViewModel> };

function TopSpendersLeaderboardSection({ vm }: Props): React.JSX.Element {
  const isIncomeView = vm.activeFlowType === 'income';
  const { labels, workspaceCurrency } = vm;
  const sourceLabels = {
    sourceBank: labels.sourceBank,
    sourceReceipt: labels.sourceReceipt,
    sourceGmailInbox: labels.sourceGmailInbox,
    sourceCrypto: labels.sourceCrypto,
  };
  const columnLabels = {
    company: labels.company,
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
    <TopSpendersLeaderboard
      rows={vm.sortedAggregatedRows}
      sortKey={vm.sortKey}
      onSortChange={vm.setSortKey}
      onRowClick={vm.setSelectedRowId}
      title={isIncomeView ? labels.incomeLeaderboard : labels.leaderboard}
      currency={workspaceCurrency}
      sourceLabels={sourceLabels}
      sortLabels={sortLabels}
      columnLabels={columnLabels}
      emptyLabel={labels.comparisonNoData}
    />
  );
}

function TopSpendersNumbers({ vm }: Props): React.JSX.Element {
  const isIncomeView = vm.activeFlowType === 'income';
  const { labels, workspaceCurrency } = vm;
  return (
    <>
      <TopSpendersStatCards
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
      <TopSpendersLeaderboardSection vm={vm} />
    </>
  );
}

/**
 * Chart mode is the illustration alone; table mode holds every figure. The
 * cards stay with the table: they count statements, the chart transactions,
 * and side by side the two totals would read as a contradiction.
 */
export function TopSpendersContent({
  vm,
  viewMode,
  month,
}: Props & { viewMode: AnalyticsViewMode; month: Date }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 24 }}>
      {viewMode === 'chart' ? (
        <AnalyticsFlowSection
          groupBy="category-merchant"
          flowType={vm.activeFlowType}
          month={month}
          resolvedTheme={vm.resolvedTheme}
          labels={vm.labels}
        />
      ) : (
        <TopSpendersNumbers vm={vm} />
      )}
    </div>
  );
}
