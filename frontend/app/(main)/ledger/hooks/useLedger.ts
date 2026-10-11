'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import apiClient from '@/app/lib/api';
import { apiQuery } from '@/app/lib/query-fn';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import type {
  AccountCard,
  AccountType,
  JournalEntry,
  JournalEntrySummary,
  LedgerAccount,
  LedgerIntegrity,
  LedgerSettings,
  Paginated,
  RevaluationResult,
  Side,
  TrialBalance,
} from '../ledger.types';

/** While the worker books the backlog, poll so the page fills in by itself. */
const CATCH_UP_POLL_MS = 3000;

function useInvalidateLedger(): () => Promise<void> {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['ledger', workspaceId] }),
    [queryClient, workspaceId],
  );
}

export function useLedgerSettings() {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.ledgerSettings(workspaceId),
    queryFn: ({ signal }) => apiQuery<LedgerSettings>({ url: '/ledger/settings', signal }),
  });
}

export function useLedgerIntegrity(enabled: boolean) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.ledgerIntegrity(workspaceId),
    queryFn: ({ signal }) => apiQuery<LedgerIntegrity>({ url: '/ledger/integrity', signal }),
    enabled,
    refetchInterval: query =>
      query.state.data &&
      query.state.data.pendingTransactions > query.state.data.failingTransactions
        ? CATCH_UP_POLL_MS
        : false,
  });
}

export function useLedgerAccounts(enabled = true) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.ledgerAccounts(workspaceId),
    queryFn: ({ signal }) => apiQuery<LedgerAccount[]>({ url: '/ledger/accounts', signal }),
    enabled,
  });
}

export interface EntryFilters {
  status?: string;
  source?: string;
  page: number;
}

export function useJournalEntries(filters: EntryFilters) {
  const workspaceId = useWorkspaceId();
  const params = {
    page: filters.page,
    limit: 25,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.source ? { source: filters.source } : {}),
  };
  return useQuery({
    queryKey: queryKeys.ledgerEntries({ workspaceId, params }),
    // Not apiQuery: its envelope unwrapping would strip the list down to `data` and lose `total`.
    queryFn: async ({ signal }) =>
      (await apiClient.get<Paginated<JournalEntrySummary>>('/ledger/entries', { params, signal }))
        .data,
    // Keeps the page visible while paging, but never across a workspace switch.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === workspaceId ? previous : undefined,
  });
}

export function useJournalEntry(id: string | null) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.ledgerEntry({ workspaceId, id }),
    queryFn: ({ signal }) => apiQuery<JournalEntry>({ url: `/ledger/entries/${id}`, signal }),
    enabled: Boolean(id),
  });
}

export interface PeriodParams {
  dateFrom: string;
  dateTo: string;
  allowStale: boolean;
}

export function useTrialBalance(params: PeriodParams, enabled: boolean) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.ledgerTrialBalance({ workspaceId, params: { ...params } }),
    queryFn: ({ signal }) =>
      apiQuery<TrialBalance>({
        url: '/ledger/reports/trial-balance',
        params: { ...params },
        signal,
      }),
    enabled,
  });
}

export function useAccountCard(accountId: string | null, params: PeriodParams & { page: number }) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.ledgerAccountCard({ workspaceId, accountId, params: { ...params } }),
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<AccountCard>(`/ledger/reports/accounts/${accountId}`, {
          params: { ...params, limit: 50 },
          signal,
        })
      ).data,
    enabled: Boolean(accountId),
  });
}

export interface EntryLineInput {
  accountId: string;
  side: Side;
  amount: string;
  currency?: string;
}

export interface EntryInput {
  entryDate: string;
  memo?: string | null;
  lines: EntryLineInput[];
}

export interface NewAccountInput {
  code: string;
  name: string;
  accountType: AccountType;
  parentId?: string;
  currency?: string;
  isPostable?: boolean;
}

/** Every write. Each one invalidates the whole ledger prefix: entries move all the reports. */
export function useLedgerMutations() {
  const invalidate = useInvalidateLedger();

  const enable = useMutation({
    mutationFn: (baseCurrency: string) =>
      apiClient.put('/ledger/settings', {
        baseCurrency,
      } satisfies ContractInput<'EnableLedgerBody'>),
    onSuccess: invalidate,
  });
  const createAccount = useMutation({
    mutationFn: (input: NewAccountInput) =>
      apiClient.post('/ledger/accounts', input satisfies ContractInput<'CreateLedgerAccountBody'>),
    onSuccess: invalidate,
  });
  const deleteAccount = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/ledger/accounts/${id}`),
    onSuccess: invalidate,
  });
  const saveDraft = useMutation({
    mutationFn: async (variables: { id: string | null; input: EntryInput }) => {
      const response = variables.id
        ? await apiClient.patch<JournalEntry>(
            `/ledger/entries/${variables.id}`,
            variables.input satisfies ContractInput<'UpdateJournalEntryBody'>,
          )
        : await apiClient.post<JournalEntry>(
            '/ledger/entries',
            variables.input satisfies ContractInput<'CreateJournalEntryBody'>,
          );
      return response.data;
    },
    onSuccess: invalidate,
  });
  const postEntry = useMutation({
    mutationFn: async (id: string) =>
      (await apiClient.post<JournalEntry>(`/ledger/entries/${id}/post`)).data,
    onSuccess: invalidate,
  });
  const reverseEntry = useMutation({
    mutationFn: async (variables: { id: string; date?: string }) =>
      (
        await apiClient.post<JournalEntry>(`/ledger/entries/${variables.id}/reverse`, {
          ...(variables.date ? { date: variables.date } : {}),
        } satisfies ContractInput<'ReverseJournalEntryBody'>)
      ).data,
    onSuccess: invalidate,
  });
  const deleteDraft = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/ledger/entries/${id}`),
    onSuccess: invalidate,
  });
  const revalue = useMutation({
    mutationFn: async (date: string) =>
      (
        await apiClient.post<RevaluationResult>('/ledger/revaluations', {
          date,
        } satisfies ContractInput<'RevalueLedgerBody'>)
      ).data,
    onSuccess: invalidate,
  });

  return {
    enable,
    createAccount,
    deleteAccount,
    saveDraft,
    postEntry,
    reverseEntry,
    deleteDraft,
    revalue,
  };
}
