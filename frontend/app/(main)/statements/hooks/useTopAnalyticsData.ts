import { useMemo } from 'react';
import { useAnalyticsData } from '@/app/(main)/statements/hooks/useAnalyticsData';
import type { TopAnalyticsStateReturn } from '@/app/(main)/statements/hooks/useTopAnalyticsState';
import { getRecordDate } from '@/app/lib/analytics-common';

type WorkspaceLike = { id: string; name?: string | null };

type BaseRecord = {
  flowType: string;
  sourceChannel: string;
  dateValue?: string;
  createdAt?: string | null;
};
type BaseAggregateRow = { id: string; flowType: string; sourceChannel: string };

type RecordsResult<TRecord, TFromOption> = {
  flowFilteredRecords: TRecord[];
  flowRecordsWithoutDateFilter: TRecord[];
  fromOptions: TFromOption[];
  currencyOptions: string[];
};

type AnalyticsRawData = { statements: unknown; transactions: unknown; gmailReceipts: unknown };

type RecordsConfig<TFlow extends string> = {
  workspaceCurrency: string;
  appliedFilters: unknown;
  searchInput: string;
  activeFlowType: TFlow;
};

type AggregationParams<TRecord, TFlow extends string, TSort extends string> = {
  flowFilteredRecords: TRecord[];
  flowRecordsWithoutDateFilter: TRecord[];
  activeFlowType: TFlow;
  sortKey: TSort;
  workspaceCurrency: string;
  resolvedTheme: string | undefined;
  sourceStatementLabel: string;
  sourceGmailLabel: string;
  totalIncomeLabel: string;
  totalSpendLabel: string;
};

export type TopAnalyticsDataConfig<
  TRecord extends BaseRecord,
  TAggregateRow extends BaseAggregateRow,
  TFromOption,
  TFlow extends string,
  TSort extends string,
  TAggregation extends { sortedAggregatedRows: TAggregateRow[] },
> = {
  user: unknown;
  currentWorkspace: WorkspaceLike | null | undefined;
  workspaces: WorkspaceLike[];
  workspaceCurrency: string;
  resolvedTheme: string | undefined;
  labels: Record<string, string>;
  state: TopAnalyticsStateReturn<TFlow, TSort>;
  includeTransactions: boolean;
  drillDownKeyExtractor: (item: TRecord | TAggregateRow) => string;
  useRecords: (
    raw: AnalyticsRawData,
    config: RecordsConfig<TFlow>,
  ) => RecordsResult<TRecord, TFromOption>;
  useAggregation: (params: AggregationParams<TRecord, TFlow, TSort>) => TAggregation;
};

export type TopAnalyticsDataReturn<TRecord, TAggregateRow, TFromOption, TAggregation> =
  TAggregation & {
    loading: boolean;
    flowFilteredRecords: TRecord[];
    fromOptions: TFromOption[];
    currencyOptions: string[];
    selectedRow: TAggregateRow | null;
    drillDownRecords: TRecord[];
  };

export function useTopAnalyticsData<
  TRecord extends BaseRecord,
  TAggregateRow extends BaseAggregateRow,
  TFromOption,
  TFlow extends string,
  TSort extends string,
  TAggregation extends { sortedAggregatedRows: TAggregateRow[] },
>(
  config: TopAnalyticsDataConfig<TRecord, TAggregateRow, TFromOption, TFlow, TSort, TAggregation>,
): TopAnalyticsDataReturn<TRecord, TAggregateRow, TFromOption, TAggregation> {
  const { statements, transactions, gmailReceipts, loading } = useAnalyticsData({
    user: config.user,
    currentWorkspace: config.currentWorkspace,
    workspaces: config.workspaces,
    workspaceFilter: config.state.workspaceFilter,
    currentWorkspaceLabel: config.labels.currentWorkspace,
    includeTransactions: config.includeTransactions,
    errorToastMessage: config.labels.loadError,
  });

  const { flowFilteredRecords, flowRecordsWithoutDateFilter, fromOptions, currencyOptions } =
    config.useRecords(
      { statements, transactions, gmailReceipts },
      {
        workspaceCurrency: config.workspaceCurrency,
        appliedFilters: config.state.filterState.appliedFilters,
        searchInput: config.state.searchInput,
        activeFlowType: config.state.activeFlowType,
      },
    );

  const aggregation = config.useAggregation({
    flowFilteredRecords,
    flowRecordsWithoutDateFilter,
    activeFlowType: config.state.activeFlowType,
    sortKey: config.state.sortKey,
    workspaceCurrency: config.workspaceCurrency,
    resolvedTheme: config.resolvedTheme,
    sourceStatementLabel: config.labels.sourceStatement,
    sourceGmailLabel: config.labels.sourceGmail,
    totalIncomeLabel: config.labels.totalIncome,
    totalSpendLabel: config.labels.totalSpend,
  });

  const selectedRow = useMemo(
    () => aggregation.sortedAggregatedRows.find(r => r.id === config.state.selectedRowId) ?? null,
    [aggregation.sortedAggregatedRows, config.state.selectedRowId],
  );

  const { drillDownKeyExtractor } = config;
  const drillDownRecords = useMemo(() => {
    if (!selectedRow) {
      return [];
    }
    const key = drillDownKeyExtractor(selectedRow);
    return flowFilteredRecords
      .filter(
        r =>
          r.flowType === selectedRow.flowType &&
          r.sourceChannel === selectedRow.sourceChannel &&
          drillDownKeyExtractor(r) === key,
      )
      .sort((a, b) => (getRecordDate(b)?.getTime() ?? 0) - (getRecordDate(a)?.getTime() ?? 0));
  }, [selectedRow, flowFilteredRecords, drillDownKeyExtractor]);

  return {
    loading,
    flowFilteredRecords,
    fromOptions,
    currencyOptions,
    selectedRow,
    drillDownRecords,
    ...aggregation,
  };
}
