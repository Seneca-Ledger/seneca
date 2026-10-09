'use client';

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import type { StatementFilters } from '../filters/statement-filters';
import type { GmailReceipt } from '../gmail-receipt-mapping';
import { useAutoOpenParsedStatement } from './useAutoOpenParsedStatement';
import { useGmailReceiptsQuery } from './useGmailReceiptsQuery';
import { useGmailSyncSkeletons } from './useGmailSyncSkeletons';
import { type StatementRecord, useStatementsQuery } from './useStatementsQuery';

export type { StatementRecord } from './useStatementsQuery';

// Stable fallbacks: `data ?? []` would mint a new array on every render while a
// query has no data, re-running every memo and effect keyed on the list.
const NO_STATEMENTS: never[] = [];
const NO_GMAIL_RECEIPTS: GmailReceipt[] = [];

interface UseStatementsListDataParams {
  appliedFilters: StatementFilters;
  categoryId?: string | null;
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

export interface UseStatementsListDataResult<T extends StatementRecord = StatementRecord> {
  statements: T[];
  gmailReceipts: GmailReceipt[];
  isPending: boolean;
  isFetching: boolean;
  gmailIsPending: boolean;
  gmailSyncSkeletonKeys: string[];
  setGmailSyncSkeletonKeys: React.Dispatch<React.SetStateAction<string[]>>;
  refetchStatements: () => void;
  refetchGmailReceipts: () => void;
  refreshActiveStatements: () => Promise<void>;
}

export function useStatementsListData<T extends StatementRecord = StatementRecord>({
  appliedFilters,
  categoryId,
  receiptStatus,
  search,
  user,
  page,
  pageSize,
  router,
  loadListErrorLabel,
  refreshFailedLabel,
}: UseStatementsListDataParams): UseStatementsListDataResult<T> {
  const statementsQuery = useStatementsQuery<T>({
    appliedFilters,
    categoryId,
    search,
    enabled: Boolean(user),
  });

  const gmailQuery = useGmailReceiptsQuery({
    categoryId,
    receiptStatus,
    page,
    pageSize,
    enabled: Boolean(user),
  });

  const { gmailSyncSkeletonKeys, setGmailSyncSkeletonKeys } = useGmailSyncSkeletons({
    pageSize,
  });

  const statements: T[] = statementsQuery.data ?? NO_STATEMENTS;

  useAutoOpenParsedStatement({ statements, enabled: Boolean(user), router });

  // Тост об ошибке загрузки: раньше его печатал каждый вызов загрузчика,
  // теперь — одна реакция на состояние запроса.
  const statementsIsError = statementsQuery.isError;
  const gmailIsError = gmailQuery.isError;
  useEffect(() => {
    if (statementsIsError || gmailIsError) {
      toast.error(loadListErrorLabel);
    }
  }, [statementsIsError, gmailIsError, loadListErrorLabel]);

  const refetchStatements = useCallback((): void => {
    void statementsQuery.refetch();
  }, [statementsQuery.refetch]);

  const refetchGmailReceipts = useCallback((): void => {
    void gmailQuery.refetch();
  }, [gmailQuery.refetch]);

  const refreshActiveStatements = useCallback(async (): Promise<void> => {
    const results = await Promise.all([statementsQuery.refetch(), gmailQuery.refetch()]);
    if (results[0]?.isError) {
      toast.error(refreshFailedLabel);
    }
  }, [statementsQuery.refetch, gmailQuery.refetch, refreshFailedLabel]);

  return {
    statements,
    gmailReceipts: gmailQuery.data ?? NO_GMAIL_RECEIPTS,
    isPending: statementsQuery.isPending,
    isFetching: statementsQuery.isFetching,
    gmailIsPending: gmailQuery.isPending,
    gmailSyncSkeletonKeys,
    setGmailSyncSkeletonKeys,
    refetchStatements,
    refetchGmailReceipts,
    refreshActiveStatements,
  };
}
