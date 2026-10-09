import { useMemo } from 'react';
import { useMonthFilters } from '@/app/(main)/statements/components/analytics/flow/useMonthFilters';
import type { StatementFilterItem } from '@/app/(main)/statements/components/filters/statement-filters';
import {
  type TopSpendersAggregationReturn,
  useTopSpendersAggregation,
} from '@/app/(main)/statements/components/top-spenders/hooks/useTopSpendersAggregation';
import {
  type FromOption,
  useTopSpendersRecords,
} from '@/app/(main)/statements/components/top-spenders/hooks/useTopSpendersRecords';
import type { useTopSpendersState } from '@/app/(main)/statements/components/top-spenders/hooks/useTopSpendersState';
import type {
  TopSpenderAggregateRow,
  TopSpenderRecord,
} from '@/app/(main)/statements/components/top-spenders/top-spenders.types';
import { useAnalyticsData } from '@/app/(main)/statements/hooks/useAnalyticsData';
import { getRecordDate } from '@/app/lib/analytics-common';

type StatementWithWorkspace = StatementFilterItem & {
  workspaceId?: string;
  workspaceName?: string;
};
type WorkspaceLike = { id: string; name?: string | null };

type Params = {
  user: unknown;
  currentWorkspace: WorkspaceLike | null | undefined;
  workspaces: WorkspaceLike[];
  workspaceCurrency: string;
  resolvedTheme: string | undefined;
  labels: Record<string, string>;
  month: Date;
  state: ReturnType<typeof useTopSpendersState>;
};

export type TopSpendersDataReturn = TopSpendersAggregationReturn & {
  loading: boolean;
  flowFilteredRecords: TopSpenderRecord[];
  fromOptions: FromOption[];
  currencyOptions: string[];
  selectedRow: TopSpenderAggregateRow | null;
  drillDownRecords: TopSpenderRecord[];
};

const filterDrillDownRecords = (
  selectedRow: TopSpenderAggregateRow,
  records: TopSpenderRecord[],
): TopSpenderRecord[] => {
  const company = selectedRow.company.trim().toLowerCase();
  const matches = (r: TopSpenderRecord): boolean =>
    r.flowType === selectedRow.flowType &&
    r.sourceChannel === selectedRow.sourceChannel &&
    r.company.trim().toLowerCase() === company;
  return records
    .filter(matches)
    .sort((a, b) => (getRecordDate(b)?.getTime() ?? 0) - (getRecordDate(a)?.getTime() ?? 0));
};

export const useTopSpendersData = ({
  user,
  currentWorkspace,
  workspaces,
  workspaceCurrency,
  resolvedTheme,
  labels,
  month,
  state,
}: Params): TopSpendersDataReturn => {
  const {
    statements: raw,
    gmailReceipts,
    loading,
  } = useAnalyticsData({
    user,
    currentWorkspace,
    workspaces,
    workspaceFilter: state.workspaceFilter,
    currentWorkspaceLabel: labels.currentWorkspace,
    includeTransactions: false,
    errorToastMessage: labels.loadError,
  });
  const statements = raw as unknown as StatementWithWorkspace[];
  const monthFilters = useMonthFilters(month);
  const { flowFilteredRecords, flowRecordsWithoutDateFilter, fromOptions, currencyOptions } =
    useTopSpendersRecords({
      statements,
      gmailReceipts,
      workspaceCurrency,
      appliedFilters: monthFilters,
      searchInput: state.searchInput,
      activeFlowType: state.activeFlowType,
    });
  const { sortedAggregatedRows, totals, comparison, topCompaniesChart, sourceChart, trendChart } =
    useTopSpendersAggregation({
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
    topCompaniesChart,
    sourceChart,
    trendChart,
    selectedRow,
    drillDownRecords,
  };
};
