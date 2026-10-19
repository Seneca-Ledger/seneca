import { useMemo } from 'react';
import { useMonthFilters } from '@/app/(main)/statements/components/analytics/flow/useMonthFilters';
import {
  type TopMerchantsAggregationReturn,
  useTopMerchantsAggregation,
} from '@/app/(main)/statements/components/top-merchants/hooks/useTopMerchantsAggregation';
import {
  type FromOption,
  useTopMerchantsRecords,
} from '@/app/(main)/statements/components/top-merchants/hooks/useTopMerchantsRecords';
import type { useTopMerchantsState } from '@/app/(main)/statements/components/top-merchants/hooks/useTopMerchantsState';
import type {
  TopMerchantAggregateRow,
  TopMerchantRecord,
} from '@/app/(main)/statements/components/top-merchants/top-merchants.types';
import { useAnalyticsData } from '@/app/(main)/statements/hooks/useAnalyticsData';
import { getRecordDate } from '@/app/lib/analytics-common';

type WorkspaceLike = { id: string; name?: string | null };

type Params = {
  user: unknown;
  currentWorkspace: WorkspaceLike | null | undefined;
  workspaces: WorkspaceLike[];
  workspaceCurrency: string;
  resolvedTheme: string | undefined;
  labels: Record<string, string>;
  month: Date;
  state: ReturnType<typeof useTopMerchantsState>;
};

export type TopMerchantsDataReturn = TopMerchantsAggregationReturn & {
  loading: boolean;
  flowFilteredRecords: TopMerchantRecord[];
  fromOptions: FromOption[];
  currencyOptions: string[];
  selectedRow: TopMerchantAggregateRow | null;
  drillDownRecords: TopMerchantRecord[];
};

const filterDrillDownRecords = (
  selectedRow: TopMerchantAggregateRow,
  records: TopMerchantRecord[],
): TopMerchantRecord[] => {
  const merchant = selectedRow.merchant.trim().toLowerCase();
  const matches = (r: TopMerchantRecord): boolean =>
    r.flowType === selectedRow.flowType &&
    r.sourceChannel === selectedRow.sourceChannel &&
    r.merchant.trim().toLowerCase() === merchant;
  return records
    .filter(matches)
    .sort((a, b) => (getRecordDate(b)?.getTime() ?? 0) - (getRecordDate(a)?.getTime() ?? 0));
};

export const useTopMerchantsData = ({
  user,
  currentWorkspace,
  workspaces,
  workspaceCurrency,
  resolvedTheme,
  labels,
  month,
  state,
}: Params): TopMerchantsDataReturn => {
  const {
    statements: rawStatements,
    transactions: rawTransactions,
    gmailReceipts,
    loading,
  } = useAnalyticsData({
    user,
    currentWorkspace,
    workspaces,
    workspaceFilter: state.workspaceFilter,
    currentWorkspaceLabel: labels.currentWorkspace,
    includeTransactions: true,
    errorToastMessage: labels.loadError,
  });
  const statements = rawStatements as unknown[];
  const monthFilters = useMonthFilters(month);
  const transactions = rawTransactions as unknown[];
  const { flowFilteredRecords, flowRecordsWithoutDateFilter, fromOptions, currencyOptions } =
    useTopMerchantsRecords({
      statements: statements as Parameters<typeof useTopMerchantsRecords>[0]['statements'],
      transactions: transactions as Parameters<typeof useTopMerchantsRecords>[0]['transactions'],
      gmailReceipts,
      workspaceCurrency,
      appliedFilters: monthFilters,
      searchInput: state.searchInput,
      activeFlowType: state.activeFlowType,
    });
  const { sortedAggregatedRows, totals, comparison, topMerchantsChart, sourceChart, trendChart } =
    useTopMerchantsAggregation({
      flowFilteredRecords,
      flowRecordsWithoutDateFilter,
      activeFlowType: state.activeFlowType,
      sortKey: state.sortKey,
      workspaceCurrency,
      resolvedTheme,
      sourceStatementLabel: labels.sourceStatement,
      sourceGmailLabel: labels.sourceGmail,
      totalIncomeLabel: labels.totalIncome,
      totalSpendLabel: labels.totalSpend,
    });
  const selectedRow = useMemo(
    () => sortedAggregatedRows.find(r => r.id === state.selectedRowId) ?? null,
    [sortedAggregatedRows, state.selectedRowId],
  );
  const drillDownRecords = useMemo(
    () => (selectedRow ? filterDrillDownRecords(selectedRow, flowFilteredRecords) : []),
    [selectedRow, flowFilteredRecords],
  );
  return {
    loading,
    flowFilteredRecords,
    fromOptions,
    currencyOptions,
    sortedAggregatedRows,
    totals,
    comparison,
    topMerchantsChart,
    sourceChart,
    trendChart,
    selectedRow,
    drillDownRecords,
  };
};
