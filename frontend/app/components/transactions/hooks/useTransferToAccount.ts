'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { invalidateFinancialData } from '@/app/lib/invalidate-document-lists';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

/**
 * "This went to another of my accounts": the accounts the row can move into
 * (active, in its currency, not its own), and the call that links or books the
 * other side there.
 */
export function useTransferToAccount(
  row: { id: string; walletId?: string | null; currency?: string },
  onDone: () => void | Promise<void>,
) {
  const workspaceId = useWorkspaceId();
  const t = useIntlayer('transactionsDrawer');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const accounts = useQuery({
    queryKey: queryKeys.wallets(workspaceId),
    queryFn: ({ signal }) => apiQueryDecoded({ url: '/wallets', signal, contract: 'WalletList' }),
    enabled: open && Boolean(workspaceId),
  });
  const currency = (row.currency ?? '').toUpperCase();
  const options = (accounts.data ?? []).filter(
    account =>
      account.isActive &&
      account.id !== row.walletId &&
      account.currency.toUpperCase() === currency,
  );

  const move = async (walletId: string) => {
    setSaving(true);
    const ok = await apiClient
      .post(`/transactions/${row.id}/transfer-to-account`, {
        walletId,
      } satisfies ContractInput<'TransferToAccountBody'>)
      .then(() => true)
      .catch((error: unknown) => {
        toast.error(getApiErrorMessage(error, t.transfer.toasts.failed.value));
        return false;
      });
    setSaving(false);
    if (ok) {
      toast.success(t.transfer.toasts.linked.value);
      setOpen(false);
      invalidateFinancialData();
      await onDone();
    }
  };

  return {
    open,
    setOpen,
    options,
    loading: accounts.isPending && open,
    saving,
    move,
  };
}
