'use client';

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import type { StatementFilters } from '../filters/statement-filters';
import type { ReceiptDocument } from '../receipt-document-mapping';
import type { RowsFilter } from '../StatementsListView.utils';
import { useAutoOpenParsedStatement } from './useAutoOpenParsedStatement';
import { useReceiptDocumentsQuery } from './useReceiptDocumentsQuery';
import { type StatementRecord, useStatementsQuery } from './useStatementsQuery';

export type { StatementRecord } from './useStatementsQuery';

// Stable fallbacks: `data ?? []` would mint a new array on every render while a
// query has no data, re-running every memo and effect keyed on the list.
const NO_STATEMENTS: never[] = [];
const NO_RECEIPTS: ReceiptDocument[] = [];

interface UseStatementsListDataParams {
  appliedFilters: StatementFilters;
  categoryId?: string | null;
  rowsFilter?: RowsFilter | null;
  receiptStatus?: string | null;
  search: string;
  user: unknown;
  page: number;
  pageSize: number;
  router: AppRouterInstance;
  /** resolveLabel(t.loadListError, 'Failed to load statements') */
  loadListErrorLabel: string;
  /** resolveLabel(t.refreshFailed, 'Failed to refresh statements') */
  refreshFailedLabel: string;
}

export interface UseStatementsListDataResult {
  statements: StatementRecord[];
  receipts: ReceiptDocument[];
  isPending: boolean;
  isFetching: boolean;
  receiptsIsPending: boolean;
  refetchStatements: () => void;
  refetchReceipts: () => void;
  refreshActiveStatements: () => Promise<void>;
}

export function useStatementsListData({
  appliedFilters,
  categoryId,
  rowsFilter,
  receiptStatus,
  search,
  user,
  page,
  pageSize,
  router,
  loadListErrorLabel,
  refreshFailedLabel,
}: UseStatementsListDataParams): UseStatementsListDataResult {
  const statementsQuery = useStatementsQuery({
    appliedFilters,
    categoryId,
    rowsFilter,
    search,
    enabled: Boolean(user),
  });

  const receiptsQuery = useReceiptDocumentsQuery({
    categoryId,
    receiptStatus,
    page,
    pageSize,
    enabled: Boolean(user),
  });

  const statements: StatementRecord[] = statementsQuery.data ?? NO_STATEMENTS;

  useAutoOpenParsedStatement({ statements, enabled: Boolean(user), router });

  // Тост об ошибке загрузки: раньше его печатал каждый вызов загрузчика,
  // теперь — одна реакция на состояние запроса.
  const statementsIsError = statementsQuery.isError;
  const receiptsIsError = receiptsQuery.isError;
  useEffect(() => {
    if (statementsIsError || receiptsIsError) {
      toast.error(loadListErrorLabel);
    }
  }, [statementsIsError, receiptsIsError, loadListErrorLabel]);

  const refetchStatements = useCallback((): void => {
    void statementsQuery.refetch();
  }, [statementsQuery.refetch]);

  const refetchReceipts = useCallback((): void => {
    void receiptsQuery.refetch();
  }, [receiptsQuery.refetch]);

  const refreshActiveStatements = useCallback(async (): Promise<void> => {
    const results = await Promise.all([statementsQuery.refetch(), receiptsQuery.refetch()]);
    if (results[0]?.isError) {
      toast.error(refreshFailedLabel);
    }
  }, [statementsQuery.refetch, receiptsQuery.refetch, refreshFailedLabel]);

  return {
    statements,
    receipts: receiptsQuery.data ?? NO_RECEIPTS,
    isPending: statementsQuery.isPending,
    isFetching: statementsQuery.isFetching,
    receiptsIsPending: receiptsQuery.isPending,
    refetchStatements,
    refetchReceipts,
    refreshActiveStatements,
  };
}
