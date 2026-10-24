'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import apiClient from '@/app/lib/api';
import { invalidateFinancialData } from '@/app/lib/invalidate-document-lists';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { apiQueryDecoded, checkContract } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import type { PayeeChoice, PayeeMode } from './types';

/** One page of the workspace's payees, newest-seen first, filtered by name. */
export function usePayeesList(search: string, limit: number, page = 1) {
  const workspaceId = useWorkspaceId();
  const params = {
    search: search.trim() || undefined,
    limit,
    page,
  } satisfies ContractInput<'PayeesQuery'>;
  return useQuery({
    queryKey: queryKeys.payees({ workspaceId, params }),
    // Not apiQuery: it would unwrap `data` and drop the total the pager needs.
    queryFn: ({ signal }) =>
      apiClient
        .get('/payees', { params, signal })
        .then(response => checkContract('PayeesPage', response.data, '/payees')),
    enabled: Boolean(workspaceId),
    // Keeps the list on screen while the search changes, but never shows one
    // workspace's payees under another's name.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === workspaceId ? previous : undefined,
  });
}

/** One payee with what it files as, its mode and its VAT details. */
export function usePayee(id: string | null) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.payee(workspaceId, id ?? ''),
    queryFn: ({ signal }) => apiQueryDecoded({ url: `/payees/${id}`, signal, contract: 'Payee' }),
    enabled: Boolean(workspaceId && id),
  });
}

/**
 * Everything that changes how rows are filed: the payee list, the Review queue
 * and the transaction lists all read it.
 */
function useInvalidatePayees() {
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['payees'] }),
        queryClient.invalidateQueries({ queryKey: ['review-inbox'] }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      ]),
    [queryClient],
  );
}

export function useUpdatePayee() {
  const invalidate = useInvalidatePayees();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      name?: string;
      mode?: PayeeMode;
      categoryId?: string | null;
      countryCode?: string | null;
      vatId?: string | null;
      supplyType?: 'goods' | 'services' | null;
    }) =>
      apiClient
        .patch(`/payees/${id}`, body satisfies ContractInput<'UpdatePayeeBody'>)
        .then(response => checkContract('PayeeRecord', response.data, '/payees/:id')),
    onSuccess: invalidate,
  });
}

/** Asks VIES again whether the payee's VAT number is valid. */
export function useRecheckPayeeVat() {
  const invalidate = useInvalidatePayees();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient
        .post(`/payees/${id}/vat-check`, {})
        .then(response => checkContract('PayeeRecord', response.data, '/payees/:id/vat-check')),
    onSuccess: invalidate,
  });
}

export function useMergePayees() {
  const invalidate = useInvalidatePayees();
  return useMutation({
    mutationFn: async ({ targetId, sourceIds }: { targetId: string; sourceIds: string[] }) => {
      await apiClient.post(`/payees/${targetId}/merge`, {
        sourceIds,
      } satisfies ContractInput<'MergePayeesBody'>);
    },
    onSuccess: invalidate,
  });
}

export function useSetTransactionPayee() {
  const invalidate = useInvalidatePayees();
  return useMutation({
    mutationFn: ({ transactionId, choice }: { transactionId: string; choice: PayeeChoice }) =>
      apiClient
        .put(
          `/transactions/${transactionId}/payee`,
          choice satisfies ContractInput<'SetTransactionPayeeBody'>,
        )
        .then(response =>
          checkContract('TransactionPayeeResult', response.data, '/transactions/:id/payee'),
        ),
    onSuccess: invalidate,
  });
}

/** Rows of a payee still waiting in Review whose category nobody chose. */
export function fetchPendingReview(
  payeeId: string,
  excludeTransactionId?: string,
): Promise<{ transactionIds: string[] }> {
  return apiQueryDecoded({
    url: `/payees/${payeeId}/pending-review`,
    params: excludeTransactionId ? { excludeTransactionId } : undefined,
    contract: 'PayeePendingReview',
  });
}

/** The Payees page: who was paid (or paid us) in a month, or ever, biggest first. */
export function usePayeesOverview(params: {
  month?: string;
  direction: 'expense' | 'income';
  search: string;
  page: number;
  limit: number;
}) {
  const workspaceId = useWorkspaceId();
  const query = {
    month: params.month,
    direction: params.direction,
    search: params.search.trim() || undefined,
    page: params.page,
    limit: params.limit,
  } satisfies ContractInput<'PayeesOverviewQuery'>;
  return useQuery({
    queryKey: queryKeys.payees({ workspaceId, params: { view: 'overview', ...query } }),
    queryFn: ({ signal }) =>
      apiClient
        .get('/payees/overview', { params: query, signal })
        .then(response => checkContract('PayeesOverview', response.data, '/payees/overview')),
    enabled: Boolean(workspaceId),
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === workspaceId ? previous : undefined,
  });
}

/** The payee card: its months, names, subscriptions and what a pinned category would change. */
export function usePayeeSummary(id: string) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.payees({ workspaceId, params: { view: 'summary', id } }),
    queryFn: ({ signal }) =>
      apiClient
        .get(`/payees/${id}/summary`, { signal })
        .then(response => checkContract('PayeeSummary', response.data, '/payees/:id/summary')),
    enabled: Boolean(workspaceId && id),
  });
}

/** Payees whose names look like one business, to offer merging. */
export function usePayeeDuplicates() {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.payees({ workspaceId, params: { view: 'duplicates' } }),
    queryFn: ({ signal }) =>
      apiClient
        .get('/payees/duplicates', { signal })
        .then(response =>
          checkContract('PayeeDuplicateGroups', response.data, '/payees/duplicates'),
        ),
    enabled: Boolean(workspaceId),
  });
}

/** Files the payee's past rows nobody categorised under its pinned category. */
export function useApplyPayeeCategory() {
  const invalidate = useInvalidatePayees();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient
        .post(`/payees/${id}/apply-category`, {})
        .then(response =>
          checkContract('PayeeChangeResult', response.data, '/payees/:id/apply-category'),
        ),
    onSuccess: () => {
      invalidateFinancialData();
      return invalidate();
    },
  });
}

/** "This name is somebody else": the alias and its rows become a payee of their own. */
export function useSplitPayeeAlias() {
  const invalidate = useInvalidatePayees();
  return useMutation({
    mutationFn: ({ id, key }: { id: string; key: string }) =>
      apiClient
        .delete(`/payees/${id}/aliases/${encodeURIComponent(key)}`)
        .then(response =>
          checkContract('PayeeChangeResult', response.data, '/payees/:id/aliases/:key'),
        ),
    onSuccess: invalidate,
  });
}
