'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import toast from 'react-hot-toast';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import type { Metal, MetalWeightUnit as WeightUnit } from '@/app/lib/contracts';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

/** The four metals with an ISO 4217 code, so the rate tables already quote them. */
export type {
  Metal,
  MetalLot,
  MetalReceipt,
  MetalSale,
  MetalsSummary,
  MetalTotals,
  MetalWeightUnit as WeightUnit,
} from '@/app/lib/contracts';

export const METALS: Metal[] = ['XAU', 'XAG', 'XPT', 'XPD'];

export const WEIGHT_UNITS: WeightUnit[] = ['g', 'ozt', 'kg'];

export interface LotDetailsInput {
  storageLocation?: string;
  insuredValue?: number;
  receiptId?: string | null;
  ownerUserId?: string | null;
}

export interface SellLotInput {
  quantity?: number;
  proceeds?: number;
  soldOn?: string;
  counterparty?: string;
}

export interface MetalLotInput {
  metal: Metal;
  name?: string;
  quantity: number;
  unitWeight: number;
  weightUnit: WeightUnit;
  purity?: number;
  acquiredOn?: string;
  costTotal?: number;
  costCurrency?: string;
  counterparty?: string;
}

export function useMetals() {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const t = useIntlayer('netWorthPage');

  const query = useQuery({
    queryKey: queryKeys.metals(workspaceId),
    queryFn: ({ signal }) => apiQueryDecoded({ url: '/metals', signal, contract: 'MetalsSummary' }),
    enabled: Boolean(workspaceId),
  });

  // A lot moves the balance sheet, so net worth is re-read with it.
  const invalidate = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.metals(workspaceId) }),
      queryClient.invalidateQueries({ queryKey: ['net-worth', workspaceId] }),
    ]);
  }, [queryClient, workspaceId]);

  const failed = t.failed.value;
  const mutation = useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
    onSuccess: invalidate,
    onError: () => toast.error(failed),
  });

  const addLot = useCallback(
    (input: MetalLotInput) => mutation.mutateAsync(() => apiClient.post('/metals/lots', input)),
    [mutation.mutateAsync],
  );
  const deleteLot = useCallback(
    (id: string) => mutation.mutateAsync(() => apiClient.delete(`/metals/lots/${id}`)),
    [mutation.mutateAsync],
  );
  const sellLot = useCallback(
    (id: string, input: SellLotInput) =>
      mutation.mutateAsync(() => apiClient.post(`/metals/lots/${id}/sell`, input)),
    [mutation.mutateAsync],
  );
  const setDealerDiscount = useCallback(
    (metal: Metal, percent: number) =>
      mutation.mutateAsync(() =>
        apiClient.patch('/metals/settings', { dealerDiscount: { [metal]: percent } }),
      ),
    [mutation.mutateAsync],
  );
  const updateLot = useCallback(
    (id: string, input: LotDetailsInput) =>
      mutation.mutateAsync(() => apiClient.patch(`/metals/lots/${id}`, input)),
    [mutation.mutateAsync],
  );
  const uploadPhoto = useCallback(
    (id: string, file: File) => {
      const body = new FormData();
      body.append('photo', file);
      return mutation.mutateAsync(() =>
        apiClient.post(`/metals/lots/${id}/photo`, body, {
          headers: { 'Content-Type': 'multipart/form-data' },
        }),
      );
    },
    [mutation.mutateAsync],
  );
  const removePhoto = useCallback(
    (id: string) => mutation.mutateAsync(() => apiClient.delete(`/metals/lots/${id}/photo`)),
    [mutation.mutateAsync],
  );
  const pricesUpdated = t.pricesUpdated.value;
  const refreshPrices = useCallback(
    () =>
      mutation.mutateAsync(async () => {
        const response = await apiClient.post<{ updated: number }>('/metals/refresh-prices');
        toast.success(pricesUpdated.replaceAll('{{count}}', String(response.data?.updated ?? 0)));
      }),
    [mutation.mutateAsync, pricesUpdated],
  );

  return {
    summary: query.data ?? null,
    isPending: query.isPending,
    saving: mutation.isPending,
    addLot,
    deleteLot,
    updateLot,
    uploadPhoto,
    removePhoto,
    sellLot,
    setDealerDiscount,
    refreshPrices,
  };
}
