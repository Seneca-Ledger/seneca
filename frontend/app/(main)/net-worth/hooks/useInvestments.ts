'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import toast from 'react-hot-toast';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { apiQueryDecoded, checkContract } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

export type { InvestmentAccount, InvestmentHolding } from '@/app/lib/contracts';

/** Coins are not here: they live on the crypto page, as wallets. */
export type InvestmentAssetClass =
  | 'stock'
  | 'etf'
  | 'fund'
  | 'bond'
  | 'cash'
  | 'real_estate'
  | 'other';

export const ASSET_CLASSES: InvestmentAssetClass[] = [
  'stock',
  'etf',
  'fund',
  'bond',
  'cash',
  'real_estate',
  'other',
];

export interface HoldingInput {
  symbol?: string | null;
  name?: string;
  assetClass?: InvestmentAssetClass;
  quantity?: number;
  price?: number;
  priceCurrency?: string;
}

export function useInvestments() {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const t = useIntlayer('netWorthPage');

  const query = useQuery({
    queryKey: queryKeys.investments(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/investments', signal, contract: 'InvestmentAccountList' }),
    enabled: Boolean(workspaceId),
  });

  // Holdings move the balance sheet, so net worth is re-read with them.
  const invalidate = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.investments(workspaceId) }),
      queryClient.invalidateQueries({ queryKey: ['net-worth', workspaceId] }),
    ]);
  }, [queryClient, workspaceId]);

  const failed = t.failed.value;
  const mutation = useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
    onSuccess: invalidate,
    onError: () => toast.error(failed),
  });

  const createAccount = useCallback(
    (name: string, kind: 'investment' | 'retirement') =>
      mutation.mutateAsync(() =>
        apiClient.post('/investments/accounts', {
          name,
          kind,
        } satisfies ContractInput<'CreateInvestmentAccountBody'>),
      ),
    [mutation.mutateAsync],
  );
  const deleteAccount = useCallback(
    (id: string) => mutation.mutateAsync(() => apiClient.delete(`/investments/accounts/${id}`)),
    [mutation.mutateAsync],
  );
  const addHolding = useCallback(
    (accountId: string, input: HoldingInput) =>
      mutation.mutateAsync(() =>
        apiClient.post(
          `/investments/accounts/${accountId}/holdings`,
          input satisfies ContractInput<'UpsertHoldingBody'>,
        ),
      ),
    [mutation.mutateAsync],
  );
  const updateHolding = useCallback(
    (id: string, input: HoldingInput) =>
      mutation.mutateAsync(() =>
        apiClient.patch(
          `/investments/holdings/${id}`,
          input satisfies ContractInput<'UpsertHoldingBody'>,
        ),
      ),
    [mutation.mutateAsync],
  );
  const deleteHolding = useCallback(
    (id: string) => mutation.mutateAsync(() => apiClient.delete(`/investments/holdings/${id}`)),
    [mutation.mutateAsync],
  );
  const pricesUpdated = t.pricesUpdated.value;
  const refreshPrices = useCallback(
    () =>
      mutation.mutateAsync(async () => {
        const response = await apiClient.post('/investments/refresh-prices');
        const { updated } = await checkContract(
          'PriceRefreshResult',
          response.data,
          '/investments/refresh-prices',
        );
        toast.success(pricesUpdated.replaceAll('{{count}}', String(updated)));
      }),
    [mutation.mutateAsync, pricesUpdated],
  );

  return {
    accounts: query.data ?? [],
    isPending: query.isPending,
    saving: mutation.isPending,
    createAccount,
    deleteAccount,
    addHolding,
    updateHolding,
    deleteHolding,
    refreshPrices,
  };
}
