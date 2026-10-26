'use client';

import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { invalidateFinancialData } from '@/app/lib/invalidate-document-lists';
import { type ContractInput, checkContract } from '@/app/lib/query-fn-schema';

interface Messages {
  confirmed: string;
  confirmFailed: string;
  deleted: string;
  deleteFailed: string;
}

interface TransactionReviewActions {
  confirm: (id: string) => void;
  remove: (id: string) => void;
  busy: boolean;
}

/**
 * Confirming a row (the same call the Review queue makes for one row) and
 * deleting it. Both change what Review and every list show, so both refresh
 * them; `onDone` closes the drawer, which would otherwise show a stale row.
 */
export function useTransactionReviewActions(
  messages: Messages,
  onDone?: () => void,
): TransactionReviewActions {
  // Confirming or deleting a row moves every figure, not only the lists.
  const refresh = async (): Promise<void> => {
    invalidateFinancialData();
  };

  const confirmMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post('/review-inbox/transactions/approve', {
        ids: [id],
      } satisfies ContractInput<'ApproveTransactionsBody'>);
      return checkContract('ReviewApproved', response.data, '/review-inbox/transactions/approve');
    },
    onSuccess: async () => {
      toast.success(messages.confirmed);
      onDone?.();
      await refresh();
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, messages.confirmFailed)),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/transactions/${id}`),
    onSuccess: async () => {
      toast.success(messages.deleted);
      onDone?.();
      await refresh();
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, messages.deleteFailed)),
  });

  return {
    confirm: confirmMutation.mutate,
    remove: removeMutation.mutate,
    busy: confirmMutation.isPending || removeMutation.isPending,
  };
}
