'use client';

import { Box } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import toast from 'react-hot-toast';
import { Select } from '@/app/components/ui/select';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

const NONE = '';

/**
 * Which of the user's accounts paid a scanned receipt. Only the scan's own
 * transaction is offered: a receipt matched to a bank row already has the
 * account the bank statement belongs to.
 */
export function ReceiptAccountField({
  transactionId,
  receiptStatementId,
}: {
  transactionId: string;
  receiptStatementId: string | null;
}): React.JSX.Element | null {
  const t = useIntlayer('receiptAccountField');
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const recordKey = queryKeys.transactionRecord({ workspaceId, transactionId });

  const record = useQuery({
    queryKey: recordKey,
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: `/transactions/${transactionId}`,
        signal,
        contract: 'TransactionRecord',
      }),
    enabled: Boolean(workspaceId),
  });
  const wallets = useQuery({
    queryKey: queryKeys.wallets(workspaceId),
    queryFn: ({ signal }) => apiQueryDecoded({ url: '/wallets', signal, contract: 'WalletList' }),
    enabled: Boolean(workspaceId),
  });
  const mutation = useMutation({
    mutationFn: async (walletId: string | null) => {
      const url = `/transactions/${transactionId}`;
      const response = await apiClient.put(url, {
        walletId,
      } satisfies ContractInput<'UpdateTransactionBody'>);
      return checkContract('TransactionRecord', response.data, url);
    },
    onSuccess: next => queryClient.setQueryData(recordKey, next),
    onError: () => toast.error(t.saveFailed.value),
    // Balances and account histories read the row's account.
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.wallets(workspaceId) }),
  });

  if (!record.data || record.data.statementId !== receiptStatementId) {
    return null;
  }
  const active = (wallets.data ?? []).filter(
    wallet => wallet.isActive || wallet.id === record.data.walletId,
  );
  return (
    <Box>
      <Box
        component="label"
        htmlFor="receipt-account"
        sx={{
          display: 'block',
          mb: 0.5,
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--foreground)',
        }}
      >
        {t.label}
      </Box>
      <Select
        fullWidth
        id="receipt-account"
        inputProps={{ 'aria-label': t.label.value }}
        value={record.data.walletId ?? NONE}
        disabled={wallets.isPending || mutation.isPending}
        onChange={next => mutation.mutate(next === NONE ? null : next)}
        options={[
          { value: NONE, label: t.none.value },
          ...active.map(wallet => ({ value: wallet.id, label: wallet.name })),
        ]}
      />
    </Box>
  );
}
