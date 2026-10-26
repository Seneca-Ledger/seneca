'use client';

import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';

export interface InvestmentAccountOption {
  id: string;
  name: string;
  kind: 'investment' | 'retirement';
}

/**
 * What a row is to an investment account: an expense paid into it, income
 * taken back out of it, or a dividend or interest it paid.
 */
export type InvestmentLinkRole = 'contribution' | 'withdrawal' | 'income';

/**
 * Links a row to an investment account as one of those, or takes the link
 * off again. The accounts are fetched when the person asks, not before.
 */
export function useContributionLink(onDone: () => void | Promise<void>) {
  const t = useIntlayer('transactionsDrawer');
  const [accounts, setAccounts] = useState<InvestmentAccountOption[] | null>(null);
  const [role, setRole] = useState<InvestmentLinkRole>('contribution');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadAccounts = useCallback(
    async (nextRole: InvestmentLinkRole = 'contribution') => {
      setRole(nextRole);
      setLoading(true);
      await apiQueryDecoded({ url: '/investments', contract: 'InvestmentAccountList' })
        .then(setAccounts)
        .catch(() => toast.error(t.transfer.toasts.failed.value));
      setLoading(false);
    },
    [t.transfer.toasts.failed.value],
  );

  const clearAccounts = useCallback(() => setAccounts(null), []);

  const link = useCallback(
    async (transactionId: string, accountId: string) => {
      setSaving(true);
      await apiClient
        .post('/investments/contributions', {
          transactionId,
          accountId,
          role,
        } satisfies ContractInput<'LinkContributionBody'>)
        .then(async () => {
          setAccounts(null);
          toast.success(t.transfer.toasts.linked.value);
          await onDone();
        })
        .catch(() => toast.error(t.transfer.toasts.failed.value));
      setSaving(false);
    },
    [onDone, role, t.transfer.toasts.failed.value, t.transfer.toasts.linked.value],
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

  return { accounts, role, loading, saving, loadAccounts, clearAccounts, link, unlink };
}
