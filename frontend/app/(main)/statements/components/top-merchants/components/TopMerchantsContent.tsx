'use client';

import { AnalyticsFlowSection } from '@/app/(main)/statements/components/analytics/flow/AnalyticsFlowSection';
import type { AnalyticsViewMode } from '@/app/(main)/statements/components/analytics/flow/analytics-flow.types';
import { TopMerchantsLeaderboard } from '@/app/(main)/statements/components/top-merchants/components/TopMerchantsLeaderboard';
import { TopMerchantsStatCards } from '@/app/(main)/statements/components/top-merchants/components/TopMerchantsStatCards';
import type { useTopMerchantsViewModel } from '@/app/(main)/statements/components/top-merchants/hooks/useTopMerchantsViewModel';

type Props = { vm: ReturnType<typeof useTopMerchantsViewModel>; focusId?: string | null };

function TopMerchantsLeaderboardSection({ vm, focusId }: Props): React.JSX.Element {
  const isIncomeView = vm.activeFlowType === 'income';
  const { labels, workspaceCurrency } = vm;
  const sourceLabels = {
    sourceBank: labels.sourceBank,
    sourceReceipt: labels.sourceReceipt,
    sourceGmailInbox: labels.sourceGmailInbox,
    sourceCrypto: labels.sourceCrypto,
  };
  const columnLabels = {
    merchant: labels.merchant,
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
    <TopMerchantsLeaderboard
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
      focusId={focusId}
    />
  );
}

function TopMerchantsNumbers({ vm, focusId = null }: Props): React.JSX.Element {
  const isIncomeView = vm.activeFlowType === 'income';
  const { labels, workspaceCurrency } = vm;
  return (
    <>
      <TopMerchantsStatCards
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
      <TopMerchantsLeaderboardSection vm={vm} focusId={focusId} />
    </>
  );
}

/**
 * Chart mode is the illustration alone; table mode holds every figure (cards
 * and leaderboard), which is also where advice links ring a row.
 */
export function TopMerchantsContent({
  vm,
  focusId = null,
  viewMode,
  month,
}: Props & { viewMode: AnalyticsViewMode; month: Date }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 24 }}>
      {viewMode === 'chart' ? (
        <AnalyticsFlowSection
          groupBy="merchant"
          flowType={vm.activeFlowType}
          month={month}
          resolvedTheme={vm.resolvedTheme}
          labels={vm.labels}
        />
      ) : (
        <TopMerchantsNumbers vm={vm} focusId={focusId} />
      )}
    </div>
  );
}
