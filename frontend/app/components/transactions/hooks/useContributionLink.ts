'use client';

import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import type { ContractInput } from '@/app/lib/query-fn-schema';

export interface InvestmentAccountOption {
  id: string;
  name: string;
  kind: 'investment' | 'retirement';
}

/**
 * Marks an expense as money moved into an investment account, or takes the
 * mark off again. The accounts are fetched when the person asks, not before.
 */
export function useContributionLink(onDone: () => void | Promise<void>) {
  const t = useIntlayer('transactionsDrawer');
  const [accounts, setAccounts] = useState<InvestmentAccountOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    await apiClient
      .get<InvestmentAccountOption[]>('/investments')
      .then(response => setAccounts(response.data ?? []))
      .catch(() => toast.error(t.transfer.toasts.failed.value));
    setLoading(false);
  }, [t.transfer.toasts.failed.value]);

  const clearAccounts = useCallback(() => setAccounts(null), []);

  const link = useCallback(
    async (transactionId: string, accountId: string) => {
      setSaving(true);
      await apiClient
        .post('/investments/contributions', {
          transactionId,
          accountId,
        } satisfies ContractInput<'LinkContributionBody'>)
        .then(async () => {
          setAccounts(null);
          toast.success(t.transfer.toasts.linked.value);
          await onDone();
        })
        .catch(() => toast.error(t.transfer.toasts.failed.value));
      setSaving(false);
    },
    [onDone, t.transfer.toasts.failed.value, t.transfer.toasts.linked.value],
  );

  const unlink = useCallback(
    async (transactionId: string) => {
      setSaving(true);
      await apiClient
        .delete(`/investments/contributions/${transactionId}`)
        .then(async () => {
          toast.success(t.transfer.toasts.unlinked.value);
          await onDone();
        })
        .catch(() => toast.error(t.transfer.toasts.failed.value));
      setSaving(false);
    },
    [onDone, t.transfer.toasts.failed.value, t.transfer.toasts.unlinked.value],
  );

  return { accounts, loading, saving, loadAccounts, clearAccounts, link, unlink };
}
