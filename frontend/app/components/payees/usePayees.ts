'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import apiClient from '@/app/lib/api';
import { apiQuery } from '@/app/lib/query-fn';
import { queryKeys } from '@/app/lib/query-keys';
import type { Payee, PayeeChoice, PayeeMode, PayeesPage, TransactionPayeeResult } from './types';

/** One page of the workspace's payees, newest-seen first, filtered by name. */
export function usePayeesList(search: string, limit: number, page = 1) {
  const workspaceId = useWorkspaceId();
  const params = { search: search.trim() || undefined, limit, page };
  return useQuery({
    queryKey: queryKeys.payees({ workspaceId, params }),
    // Not apiQuery: it would unwrap `data` and drop the total the pager needs.
    queryFn: ({ signal }) =>
      apiClient.get<PayeesPage>('/payees', { params, signal }).then(response => response.data),
    enabled: Boolean(workspaceId),
    // Keeps the list on screen while the search changes, but never shows one
    // workspace's payees under another's name.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === workspaceId ? previous : undefined,
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
    }) => apiClient.patch<Payee>(`/payees/${id}`, body).then(response => response.data),
    onSuccess: invalidate,
  });
}

/** Asks VIES again whether the payee's VAT number is valid. */
export function useRecheckPayeeVat() {
  const invalidate = useInvalidatePayees();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<Payee>(`/payees/${id}/vat-check`, {}).then(response => response.data),
    onSuccess: invalidate,
  });
}

export function useMergePayees() {
  const invalidate = useInvalidatePayees();
  return useMutation({
    mutationFn: ({ targetId, sourceIds }: { targetId: string; sourceIds: string[] }) =>
      apiClient
        .post<{ merged: number }>(`/payees/${targetId}/merge`, { sourceIds })
        .then(response => response.data),
    onSuccess: invalidate,
  });
}

export function useSetTransactionPayee() {
  const invalidate = useInvalidatePayees();
  return useMutation({
    mutationFn: ({ transactionId, choice }: { transactionId: string; choice: PayeeChoice }) =>
      apiClient
        .put<TransactionPayeeResult>(`/transactions/${transactionId}/payee`, choice)
        .then(response => response.data),
    onSuccess: invalidate,
  });
}

/** Rows of a payee still waiting in Review whose category nobody chose. */
export function fetchPendingReview(
  payeeId: string,
  excludeTransactionId?: string,
): Promise<{ transactionIds: string[] }> {
  return apiQuery<{ transactionIds: string[] }>({
    url: `/payees/${payeeId}/pending-review`,
    params: excludeTransactionId ? { excludeTransactionId } : undefined,
  });
}
