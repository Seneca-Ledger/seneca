'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

export type AgeingBucket = 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90_plus';

export interface OpenItem {
  id: string;
  direction: 'payable' | 'receivable';
  vendor: string;
  amount: number;
  currency: string;
  dueDate: string | null;
  createdAt: string;
  status: string;
  amountInWorkspace: number;
}

export interface BankRow {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  currency: string;
  date: string;
  counterpartyName: string | null;
  paymentPurpose: string | null;
}

export interface ReconciliationData {
  currency: string;
  matches: Array<{
    itemId: string;
    transactionId: string;
    confidence: number;
    reasons: Array<'amount' | 'vendor' | 'date'>;
    item: OpenItem;
    transaction: BankRow;
  }>;
  unmatchedItems: OpenItem[];
  unmatchedRowCount: number;
  duplicates: Array<{ vendor: string; amount: number; currency: string; itemIds: string[] }>;
  ageing: Array<{
    direction: 'payable' | 'receivable';
    buckets: Record<AgeingBucket, number>;
    total: number;
    top: Array<{ vendor: string; amount: number; bucket: AgeingBucket }>;
  }>;
}

export function useReconciliation() {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const t = useIntlayer('reconcilePage');

  const query = useQuery({
    queryKey: queryKeys.reconciliation(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/reconciliation', signal, contract: 'ReconciliationResponse' }),
    enabled: Boolean(workspaceId),
  });

  const confirmed = t.confirmed.value;
  const failed = t.confirmFailed.value;
  const confirmMutation = useMutation({
    mutationFn: (input: { payableId: string; transactionId: string }) =>
      apiClient.post(
        '/reconciliation/confirm',
        input satisfies ContractInput<'ConfirmReconciliationBody'>,
      ),
    onSuccess: () => toast.success(confirmed),
    onError: () => toast.error(failed),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.reconciliation(workspaceId) }),
        queryClient.invalidateQueries({ queryKey: ['payables', workspaceId] }),
      ]),
  });

  return {
    data: query.data ?? null,
    isPending: query.isPending,
    isFetching: query.isFetching,
    error: query.error ? String(query.error) : null,
    confirm: (payableId: string, transactionId: string) =>
      confirmMutation.mutateAsync({ payableId, transactionId }),
    confirming: confirmMutation.isPending,
  };
}
