'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import toast from 'react-hot-toast';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { apiQuery } from '@/app/lib/query-fn';
import { queryKeys } from '@/app/lib/query-keys';

/** The four metals with an ISO 4217 code, so the rate tables already quote them. */
export type Metal = 'XAU' | 'XAG' | 'XPT' | 'XPD';

export const METALS: Metal[] = ['XAU', 'XAG', 'XPT', 'XPD'];

export type WeightUnit = 'g' | 'ozt' | 'kg';

export const WEIGHT_UNITS: WeightUnit[] = ['g', 'ozt', 'kg'];

export interface MetalLot {
  id: string;
  metal: Metal;
  name: string;
  /** Pieces in the lot. */
  quantity: number;
  unitWeight: number;
  weightUnit: WeightUnit;
  purity: number;
  fineOunces: number;
  price: number;
  priceCurrency: string;
  priceSource: 'manual' | 'auto';
  pricedAt: string | null;
  value: number;
  acquiredOn: string | null;
  counterparty: string | null;
  costTotal: number | null;
  costCurrency: string | null;
  cost: number | null;
  gain: number | null;
  /** What one fine ounce cost. */
  costPerOunce: number | null;
  /** Paid over the melt value on the day it was bought. */
  premium: number | null;
  premiumPercent: number | null;
  /** Melt value less what a dealer keeps. */
  dealerValue: number;
  roi: number | null;
  /** Germany only: the day a private sale stops being taxable (§ 23 EStG). */
  taxFreeFrom: string | null;
  photoUrl: string | null;
  storageLocation: string | null;
  insuredValue: number | null;
  insuredCurrency: string | null;
  insured: number | null;
  receipt: MetalReceipt | null;
  /** Whose metal it is; a tax return belongs to a person, not to a workspace. */
  ownerUserId: string | null;
}

export interface MetalReceipt {
  id: string;
  vendor: string | null;
  date: string | null;
  amount: number | null;
  currency: string | null;
}

export interface MetalTotals {
  metal: Metal;
  fineOunces: number;
  price: number;
  pricedAt: string | null;
  value: number;
  cost: number;
  gain: number;
  /** Average cost of a fine ounce across the lots still held. */
  costPerOunce: number | null;
  dealerValue: number;
  dealerDiscount: number;
  realized: number;
}

export interface MetalSale {
  id: string;
  metal: Metal;
  lotName: string;
  quantity: number;
  fineOunces: number;
  proceeds: number;
  proceedsCurrency: string;
  costBasis: number | null;
  realized: number | null;
  soldOn: string;
  acquiredOn: string | null;
  counterparty: string | null;
  ownerUserId: string | null;
}

export interface MetalsSummary {
  currency: string;
  value: number;
  cost: number;
  gain: number;
  dealerValue: number;
  realized: number;
  insured: number;
  byMetal: MetalTotals[];
  lots: MetalLot[];
  sales: MetalSale[];
  dealerDiscount: Record<Metal, number>;
  accountId: string | null;
  /** Country the workspace files tax in; the holding period is German law. */
  jurisdiction: string | null;
}

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
    queryFn: ({ signal }) => apiQuery<MetalsSummary>({ url: '/metals', signal }),
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
