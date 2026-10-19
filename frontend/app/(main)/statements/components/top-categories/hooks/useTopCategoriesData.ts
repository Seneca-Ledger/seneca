import { useMemo } from 'react';
import { useMonthFilters } from '@/app/(main)/statements/components/analytics/flow/useMonthFilters';
import {
  type TopCategoriesAggregationReturn,
  useTopCategoriesAggregation,
} from '@/app/(main)/statements/components/top-categories/hooks/useTopCategoriesAggregation';
import {
  type CategoryFromOption,
  useTopCategoriesRecords,
} from '@/app/(main)/statements/components/top-categories/hooks/useTopCategoriesRecords';
import type { useTopCategoriesState } from '@/app/(main)/statements/components/top-categories/hooks/useTopCategoriesState';
import type {
  TopCategoryAggregateRow,
  TopCategoryRecord,
} from '@/app/(main)/statements/components/top-categories.utils';
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
  state: ReturnType<typeof useTopCategoriesState>;
};

export type TopCategoriesDataReturn = TopCategoriesAggregationReturn & {
  loading: boolean;
  flowFilteredRecords: TopCategoryRecord[];
  fromOptions: CategoryFromOption[];
  currencyOptions: string[];
  selectedRow: TopCategoryAggregateRow | null;
  drillDownRecords: TopCategoryRecord[];
};

const filterDrillDownRecords = (
  selectedRow: TopCategoryAggregateRow,
  records: TopCategoryRecord[],
): TopCategoryRecord[] => {
  const category = selectedRow.category.trim().toLowerCase();
  const matches = (r: TopCategoryRecord): boolean =>
    r.flowType === selectedRow.flowType &&
    r.sourceChannel === selectedRow.sourceChannel &&
    r.category.trim().toLowerCase() === category;
  return records
    .filter(matches)
    .sort((a, b) => (getRecordDate(b)?.getTime() ?? 0) - (getRecordDate(a)?.getTime() ?? 0));
};

export const useTopCategoriesData = ({
  user,
  currentWorkspace,
  workspaces,
  workspaceCurrency,
  resolvedTheme,
  labels,
  month,
  state,
}: Params): TopCategoriesDataReturn => {
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
    useTopCategoriesRecords({
      statements: statements as Parameters<typeof useTopCategoriesRecords>[0]['statements'],
      transactions: transactions as Parameters<typeof useTopCategoriesRecords>[0]['transactions'],
      gmailReceipts,
      workspaceCurrency,
      appliedFilters: monthFilters,
      searchInput: state.searchInput,
      activeFlowType: state.activeFlowType,
    });
  const { sortedAggregatedRows, totals, comparison, topCategoriesChart, sourceChart, trendChart } =
    useTopCategoriesAggregation({
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
    topCategoriesChart,
    sourceChart,
    trendChart,
    selectedRow,
    drillDownRecords,
  };
};
