import { useMemo } from 'react';
import { useMonthFilters } from '@/app/(main)/statements/components/analytics/flow/useMonthFilters';
import { useTopCategoriesAggregation } from '@/app/(main)/statements/components/top-categories/hooks/useTopCategoriesAggregation';
import {
  filterDrillDownRecords,
  type TopCategoriesDataReturn,
} from '@/app/(main)/statements/components/top-categories/hooks/useTopCategoriesData';
import { useTopCategoriesRecords } from '@/app/(main)/statements/components/top-categories/hooks/useTopCategoriesRecords';
import type { useTopCategoriesState } from '@/app/(main)/statements/components/top-categories/hooks/useTopCategoriesState';
import { expandRecordsByTag } from '@/app/(main)/statements/components/top-tags/tag-records';
import { useAnalyticsData } from '@/app/(main)/statements/hooks/useAnalyticsData';
import { useTags, useTransactionTagLinks } from '@/app/hooks/useTags';

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

const NO_LINKS: Array<{ transactionId: string; tagId: string }> = [];
const NO_TAGS: Array<{ id: string; name: string }> = [];

/**
 * The category pipeline (records, month, flow, aggregation) with each record
 * filed under its tags instead of its category, so the By tag table counts
 * money the way By category does.
 */
export const useTopTagsData = ({
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
    receipts,
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
  const linksQuery = useTransactionTagLinks();
  const tagsQuery = useTags();
  const monthFilters = useMonthFilters(month);
  const records = useTopCategoriesRecords({
    statements: rawStatements as Parameters<typeof useTopCategoriesRecords>[0]['statements'],
    transactions: rawTransactions as Parameters<typeof useTopCategoriesRecords>[0]['transactions'],
    receipts,
    workspaceCurrency,
    appliedFilters: monthFilters,
    searchInput: state.searchInput,
    activeFlowType: state.activeFlowType,
  });
  const links = linksQuery.data ?? NO_LINKS;
  const tags = tagsQuery.data ?? NO_TAGS;
  const flowFilteredRecords = useMemo(
    () => expandRecordsByTag(records.flowFilteredRecords, links, receipts, tags),
    [records.flowFilteredRecords, links, receipts, tags],
  );
  const flowRecordsWithoutDateFilter = useMemo(
    () => expandRecordsByTag(records.flowRecordsWithoutDateFilter, links, receipts, tags),
    [records.flowRecordsWithoutDateFilter, links, receipts, tags],
  );
  const aggregation = useTopCategoriesAggregation({
    flowFilteredRecords,
    flowRecordsWithoutDateFilter,
    activeFlowType: state.activeFlowType,
    sortKey: state.sortKey,
    workspaceCurrency,
    resolvedTheme,
    sourceStatementLabel: labels.sourceStatement,
    sourceReceiptLabel: labels.sourceReceipt,
    totalIncomeLabel: labels.totalIncome,
    totalSpendLabel: labels.totalSpend,
  });
  const selectedRow = useMemo(
    () => aggregation.sortedAggregatedRows.find(r => r.id === state.selectedRowId) ?? null,
    [aggregation.sortedAggregatedRows, state.selectedRowId],
  );
  const drillDownRecords = useMemo(
    () => (selectedRow ? filterDrillDownRecords(selectedRow, flowFilteredRecords) : []),
    [selectedRow, flowFilteredRecords],
  );

  return {
    ...aggregation,
    loading: loading || linksQuery.isPending || tagsQuery.isPending,
    flowFilteredRecords,
    fromOptions: records.fromOptions,
    currencyOptions: records.currencyOptions,
    selectedRow,
    drillDownRecords,
  };
};
