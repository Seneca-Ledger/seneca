'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import apiClient from '@/app/lib/api';
import { invalidateFinancialData } from '@/app/lib/invalidate-document-lists';
import { checkContract } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

/**
 * A row's history in words. Under the transactions root, so any edit that
 * refreshes the figures refreshes the history too.
 */
export function useTransactionHistory(transactionId: string | undefined, enabled: boolean) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.transactions({ workspaceId, params: { view: 'history', transactionId } }),
    queryFn: ({ signal }) =>
      apiClient
        .get(`/transactions/${transactionId}/history`, { signal })
        .then(response =>
          checkContract('TransactionHistory', response.data, '/transactions/:id/history'),
        ),
    enabled: enabled && Boolean(workspaceId && transactionId),
  });
}

/** Puts back the fields of one change; it is an edit like any other, so every figure refreshes. */
export function useUndoHistoryChange(transactionId: string) {
  return useMutation({
    mutationFn: (eventId: string) =>
      apiClient
        .post(`/transactions/${transactionId}/history/${eventId}/undo`)
        .then(response =>
          checkContract(
            'TransactionHistory',
            response.data,
            '/transactions/:id/history/:eventId/undo',
          ),
        ),
    onSuccess: () => invalidateFinancialData(),
  });
}
