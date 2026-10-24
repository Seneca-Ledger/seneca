'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { WalletItem, WalletType } from '@/app/lib/contracts';
import { invalidateFinancialData } from '@/app/lib/invalidate-document-lists';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { isDebtType } from '../account-types';

export type Account = WalletItem;

export interface AccountForm {
  type: WalletType;
  name: string;
  bankName: string;
  accountNumber: string;
  currency: string;
  /**
   * As the person types it: for a debt, how much is owed (positive). The API
   * keeps a debt below zero, so the sign flips on the way in and out.
   */
  openingBalance: string;
  ownerMemberId: string | null;
  /** Statements to move into a new account (creating one from found statements). */
  statementIds?: string[];
}

export const emptyAccountForm = (currency: string): AccountForm => ({
  type: 'checking',
  name: '',
  bankName: '',
  accountNumber: '',
  currency,
  openingBalance: '',
  ownerMemberId: null,
});

export function accountToForm(account: Account): AccountForm {
  const opening = Number(account.initialBalance) || 0;
  return {
    type: account.type,
    name: account.name,
    bankName: account.bankName ?? '',
    accountNumber: account.accountNumber ?? '',
    currency: account.currency,
    openingBalance: opening === 0 ? '' : String(isDebtType(account.type) ? -opening : opening),
    ownerMemberId: account.ownerMemberId,
  };
}

function toPayload(form: AccountForm) {
  const typed = Number(form.openingBalance.replace(',', '.')) || 0;
  return {
    type: form.type,
    name: form.name.trim(),
    bankName: form.bankName.trim() || null,
    accountNumber: form.accountNumber.trim() || null,
    // Empty means the workspace's own currency, which the server fills in.
    currency: form.currency || null,
    initialBalance: isDebtType(form.type) ? -Math.abs(typed) : typed,
    ownerMemberId: form.ownerMemberId,
  };
}

/** Every account with its balance, the totals, and the statements no account holds yet. */
export function useAccounts() {
  const workspaceId = useWorkspaceId();
  const enabled = Boolean(workspaceId);

  const accounts = useQuery({
    queryKey: queryKeys.wallets(workspaceId),
    queryFn: ({ signal }) => apiQueryDecoded({ url: '/wallets', signal, contract: 'WalletList' }),
    enabled,
  });
  const summary = useQuery({
    queryKey: queryKeys.walletsSummary(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/wallets/summary', signal, contract: 'WalletSummary' }),
    enabled,
  });
  const unlinked = useQuery({
    queryKey: queryKeys.walletsUnlinked(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: '/wallets/unlinked-statements',
        signal,
        contract: 'AccountStatementList',
      }),
    enabled,
  });

  return {
    accounts: accounts.data ?? [],
    summary: summary.data ?? null,
    unlinked: unlinked.data ?? [],
    isPending: accounts.isPending,
    isFetching: accounts.isFetching,
    error: accounts.error,
  };
}

/** One account with its balance history, its statements and its latest rows. */
export function useAccount(id: string) {
  const workspaceId = useWorkspaceId();
  const enabled = Boolean(workspaceId && id);
  const base = queryKeys.wallet(workspaceId, id);

  const account = useQuery({
    queryKey: base,
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: `/wallets/${id}`, signal, contract: 'WalletItem' }),
    enabled,
  });
  const series = useQuery({
    queryKey: [...base, 'series'],
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: `/wallets/${id}/series`, signal, contract: 'WalletSeries' }),
    enabled,
  });
  const statements = useQuery({
    queryKey: [...base, 'statements'],
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: `/wallets/${id}/statements`,
        signal,
        contract: 'AccountStatementList',
      }),
    enabled,
  });
  const transactions = useQuery({
    queryKey: [...base, 'transactions'],
    // A `{ data, total }` page: checked raw, since apiQueryDecoded would unwrap `data`.
    queryFn: async ({ signal }) => {
      const url = `/transactions?walletId=${id}&running_balance=1&limit=50`;
      const response = await apiClient.get(url, { signal });
      return checkContract('TransactionListPage', response.data, url);
    },
    enabled,
  });

  return {
    account: account.data ?? null,
    series: series.data ?? [],
    statements: statements.data ?? [],
    transactions: transactions.data?.data ?? [],
    isPending: account.isPending,
    error: account.error,
  };
}

/**
 * Writes to accounts; each one refreshes every figure an account feeds (net
 * worth, forecast…). A failure is said in a toast, in the server's words when
 * it gave a known code ("the account holds EUR; the statement is in USD").
 */
export function useAccountMutations(failedText: string) {
  const mutation = useMutation({
    mutationFn: (request: () => Promise<unknown>) => request(),
    onError: error => toast.error(getApiErrorMessage(error, failedText)),
    onSettled: () => invalidateFinancialData(),
  });

  const run = (request: () => Promise<unknown>) =>
    mutation
      .mutateAsync(request)
      .then(() => true)
      .catch(() => false);

  return {
    saving: mutation.isPending,
    create: (form: AccountForm) =>
      run(async () => {
        const response = await apiClient.post('/wallets', {
          ...toPayload(form),
          ...(form.statementIds?.length ? { statementIds: form.statementIds } : {}),
        } satisfies ContractInput<'CreateWalletRequest'>);
        return response.data;
      }),
    update: (id: string, form: AccountForm) =>
      run(() =>
        apiClient.put(
          `/wallets/${id}`,
          toPayload(form) satisfies ContractInput<'UpdateWalletBody'>,
        ),
      ),
    setActive: (id: string, isActive: boolean) =>
      run(() =>
        apiClient.put(`/wallets/${id}`, { isActive } satisfies ContractInput<'UpdateWalletBody'>),
      ),
    remove: (id: string) => run(() => apiClient.delete(`/wallets/${id}`)),
    attach: (id: string, statementIds: string[]) =>
      run(async () => {
        const response = await apiClient.post(`/wallets/${id}/statements`, {
          statementIds,
        } satisfies ContractInput<'AttachStatementsBody'>);
        return checkContract('AttachStatementsResult', response.data, `/wallets/${id}/statements`);
      }),
    detach: (id: string, statementId: string) =>
      run(() => apiClient.delete(`/wallets/${id}/statements/${statementId}`)),
  };
}
