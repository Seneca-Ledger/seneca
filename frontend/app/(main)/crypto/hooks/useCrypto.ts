'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import apiClient from '@/app/lib/api';
import { getApiErrorStatus } from '@/app/lib/api-error';
import { apiQuery } from '@/app/lib/query-fn';
import { queryKeys } from '@/app/lib/query-keys';

/** An address we read, a line the user keeps, or a CSV an exchange exported. */
export type CryptoWalletKind = 'onchain' | 'manual' | 'exchange';

export interface CryptoWalletBalance {
  asset: string;
  amount: string;
  costPerUnit?: number;
}

export interface CryptoWallet {
  id: string;
  address: string | null;
  kind: CryptoWalletKind;
  /** Filled for a manual wallet only. */
  balances: CryptoWalletBalance[];
  chainId: number;
  chainName: string;
  label: string | null;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  transactionCount: number;
}

export interface CryptoHolding {
  asset: string;
  amount: string;
  /** Current price of one unit, in the summary currency. */
  price: number;
  value: number;
  /** Null when no purchase of this asset is on record. */
  avgCost: number | null;
  cost: number | null;
  unrealized: number | null;
  unrealizedPercent: number | null;
  realized: number;
  basisIncomplete: boolean;
}

export interface CryptoSummary {
  currency: string;
  portfolioValue: number;
  income: number;
  expense: number;
  walletCount: number;
  holdings: CryptoHolding[];
  /** Held but unpriceable, so deliberately outside `portfolioValue`. */
  unpriced: { asset: string; amount: string }[];
  cost: number | null;
  unrealized: number | null;
  realized: number;
  /** Percent move against yesterday's prices; null when a price is missing. */
  portfolioChangeSinceYesterday: number | null;
}

export interface CryptoHistory {
  currency: string;
  series: { date: string; value: number }[];
}

export interface CryptoDisposal {
  /** Unique within the report: same coin, same day, same size can happen twice. */
  id: string;
  asset: string;
  date: string;
  amount: number;
  proceeds: number;
  cost: number;
  gain: number;
  /** Null when no purchase backs the sale at all. */
  acquiredOn: string | null;
  heldDays: number | null;
  /** Coins in this sale that no purchase backs. */
  uncoveredAmount: number;
  uncoveredProceeds: number;
  /** True when part of the sale has no cost to measure against. */
  costIncomplete: boolean;
}

export interface CryptoGains {
  currency: string;
  disposals: CryptoDisposal[];
  proceeds: number;
  cost: number;
  gain: number;
  /** How many rows carry coins without a purchase behind them. */
  incompleteCount?: number;
}

export interface ExchangeImportResult {
  exchange: string;
  imported: number;
  skipped: number;
  walletId: string;
}

export interface ManualHoldingInput {
  asset: string;
  amount: string;
  costPerUnit?: number;
}

export interface CryptoTransaction {
  id: string;
  date: string;
  walletId: string;
  walletLabel: string | null;
  walletAddress: string | null;
  walletChainName: string | null;
  direction: 'in' | 'out';
  asset: string | null;
  cryptoAmount: string | null;
  amount: number;
  currency: string;
  counterparty: string | null;
  txHash: string | null;
}

export type ChainFamily = 'evm' | 'tron' | 'bitcoin' | 'solana';

export interface CryptoNetwork {
  chainId: number;
  name: string;
  family: ChainFamily;
  nativeAsset: string;
}

const EVM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const TRON_ADDRESS_PATTERN = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const BITCOIN_BECH32_PATTERN = /^(bc1[02-9ac-hj-np-z]{11,71}|BC1[02-9AC-HJ-NP-Z]{11,71})$/;
const BITCOIN_BASE58_PATTERN = /^[13][1-9A-HJ-NP-Za-km-z]{25,33}$/;
const SOLANA_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
/** A whole Bitcoin wallet rather than one of its addresses. */
const EXTENDED_KEY_PATTERN = /^[xyz]pub[1-9A-HJ-NP-Za-km-z]{95,115}$/;

/**
 * The network family an address looks like, for the connect form. It goes by shape
 * only; the server has the final word (it checks Bitcoin and Tron checksums and
 * the length of a Solana key), so a rare look-alike is rejected there, not booked.
 */
export function addressFamily(address: string): ChainFamily | null {
  if (EVM_ADDRESS_PATTERN.test(address)) {
    return 'evm';
  }
  if (TRON_ADDRESS_PATTERN.test(address)) {
    return 'tron';
  }
  if (
    BITCOIN_BECH32_PATTERN.test(address) ||
    BITCOIN_BASE58_PATTERN.test(address) ||
    EXTENDED_KEY_PATTERN.test(address)
  ) {
    return 'bitcoin';
  }
  if (SOLANA_PATTERN.test(address)) {
    return 'solana';
  }
  return null;
}

export function isSupportedAddress(address: string): boolean {
  return addressFamily(address) !== null;
}

interface UseCryptoState {
  wallets: CryptoWallet[];
  summary: CryptoSummary | null;
  transactions: CryptoTransaction[];
  networks: CryptoNetwork[];
  isPending: boolean;
  error: CryptoError;
  busyWalletId: string | null;
  connecting: boolean;
  refetch: () => void;
  connectWallet: (address: string, label?: string, chainIds?: number[]) => Promise<boolean>;
  syncWallet: (id: string) => void;
  removeWallet: (id: string) => void;
  history: CryptoHistory | null;
  savingHolding: boolean;
  saveHolding: (holding: ManualHoldingInput) => Promise<boolean>;
  removeHolding: (asset: string) => void;
  importing: boolean;
  importExchangeCsv: (file: File) => Promise<ExchangeImportResult | null>;
  gains: CryptoGains | null;
  gainsYear: number | null;
  setGainsYear: (year: number | null) => void;
}

/** Доменный словарь страницы: дубликат адреса пользователь может исправить сам. */
type CryptoError = 'duplicate' | 'failed' | null;

function resolveConnectError(error: unknown): CryptoError {
  if (!error) return null;
  return getApiErrorStatus(error) === 409 ? 'duplicate' : 'failed';
}

/** Вложенные тернарники запрещены Biome — отсюда отдельный хелпер. */
function resolveBusyWalletId(
  sync: { isPending: boolean; variables?: string },
  remove: { isPending: boolean; variables?: string },
): string | null {
  if (sync.isPending) return sync.variables ?? null;
  if (remove.isPending) return remove.variables ?? null;
  return null;
}

export function useCrypto(): UseCryptoState {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();

  const walletsQuery = useQuery({
    queryKey: queryKeys.cryptoWallets(workspaceId),
    queryFn: ({ signal }) => apiQuery<CryptoWallet[]>({ url: '/crypto/wallets', signal }),
  });

  const summaryQuery = useQuery({
    queryKey: queryKeys.cryptoSummary(workspaceId),
    queryFn: ({ signal }) => apiQuery<CryptoSummary>({ url: '/crypto/summary', signal }),
  });

  const transactionsQuery = useQuery({
    queryKey: queryKeys.cryptoTransactions(workspaceId),
    queryFn: ({ signal }) => apiQuery<CryptoTransaction[]>({ url: '/crypto/transactions', signal }),
  });

  const historyQuery = useQuery({
    queryKey: queryKeys.cryptoHistory(workspaceId),
    queryFn: ({ signal }) => apiQuery<CryptoHistory>({ url: '/crypto/history', signal }),
  });

  // Год приходит в ключ запроса: смена года — другой запрос, а не ручная перезагрузка.
  const [gainsYear, setGainsYear] = useState<number | null>(null);
  const gainsQuery = useQuery({
    queryKey: queryKeys.cryptoGains(workspaceId, gainsYear),
    queryFn: ({ signal }) =>
      apiQuery<CryptoGains>({
        url: '/crypto/gains',
        params: gainsYear ? { year: gainsYear } : undefined,
        signal,
      }),
  });

  // Список сетей статичен на сервере — один запрос на сессию.
  const networksQuery = useQuery({
    queryKey: queryKeys.cryptoNetworks(workspaceId),
    queryFn: ({ signal }) => apiQuery<CryptoNetwork[]>({ url: '/crypto/networks', signal }),
    staleTime: Number.POSITIVE_INFINITY,
  });

  // Общий префикс ключа: одна инвалидация сметает и кошельки, и сводку.
  const invalidateCrypto = useCallback((): Promise<void> => {
    return queryClient.invalidateQueries({ queryKey: ['crypto'] });
  }, [queryClient]);

  const connectMutation = useMutation({
    mutationFn: (variables: { address: string; label?: string; chainIds?: number[] }) =>
      apiClient.post('/crypto/wallets', {
        address: variables.address,
        chainIds: variables.chainIds,
        label: variables.label?.trim() ? variables.label.trim() : undefined,
      }),
    onSuccess: invalidateCrypto,
  });

  const syncMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/crypto/wallets/${id}/sync`),
    onSuccess: invalidateCrypto,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/crypto/wallets/${id}`),
    onSuccess: invalidateCrypto,
  });

  const importMutation = useMutation({
    mutationFn: async (file: File): Promise<ExchangeImportResult> => {
      const form = new FormData();
      form.append('file', file);
      const response = await apiClient.post('/crypto/import', form);
      return (response.data?.data ?? response.data) as ExchangeImportResult;
    },
    onSuccess: invalidateCrypto,
  });

  const saveHoldingMutation = useMutation({
    mutationFn: (holding: ManualHoldingInput) => apiClient.post('/crypto/holdings', holding),
    onSuccess: invalidateCrypto,
  });

  const removeHoldingMutation = useMutation({
    mutationFn: (asset: string) => apiClient.delete(`/crypto/holdings/${asset}`),
    onSuccess: invalidateCrypto,
  });

  const connectWallet = useCallback(
    async (address: string, label?: string, chainIds?: number[]): Promise<boolean> => {
      return await connectMutation
        .mutateAsync({ address, label, chainIds })
        .then(() => true)
        .catch(() => false);
    },
    [connectMutation.mutateAsync],
  );

  const syncWallet = useCallback(
    (id: string): void => {
      syncMutation.mutate(id);
    },
    [syncMutation.mutate],
  );

  const removeWallet = useCallback(
    (id: string): void => {
      removeMutation.mutate(id);
    },
    [removeMutation.mutate],
  );

  const saveHolding = useCallback(
    async (holding: ManualHoldingInput): Promise<boolean> => {
      return await saveHoldingMutation
        .mutateAsync(holding)
        .then(() => true)
        .catch(() => false);
    },
    [saveHoldingMutation.mutateAsync],
  );

  const importExchangeCsv = useCallback(
    async (file: File): Promise<ExchangeImportResult | null> => {
      return await importMutation
        .mutateAsync(file)
        .then(result => result)
        .catch(() => null);
    },
    [importMutation.mutateAsync],
  );

  const removeHolding = useCallback(
    (asset: string): void => {
      removeHoldingMutation.mutate(asset);
    },
    [removeHoldingMutation.mutate],
  );

  // «Повторить» снимает и ошибку упавшего синка/удаления: иначе плашка висела бы
  // над уже перезагруженными данными.
  const refetch = useCallback((): void => {
    syncMutation.reset();
    removeMutation.reset();
    void walletsQuery.refetch();
    void summaryQuery.refetch();
    void transactionsQuery.refetch();
    void historyQuery.refetch();
  }, [
    syncMutation.reset,
    removeMutation.reset,
    walletsQuery.refetch,
    summaryQuery.refetch,
    transactionsQuery.refetch,
    historyQuery.refetch,
  ]);

  const loadFailed = walletsQuery.isError || summaryQuery.isError;
  const mutationFailed = syncMutation.isError || removeMutation.isError;

  return {
    wallets: walletsQuery.data ?? [],
    summary: summaryQuery.data ?? null,
    transactions: transactionsQuery.data ?? [],
    networks: networksQuery.data ?? [],
    isPending: walletsQuery.isPending || summaryQuery.isPending,
    error:
      resolveConnectError(connectMutation.error) ??
      (loadFailed || mutationFailed ? 'failed' : null),
    busyWalletId: resolveBusyWalletId(syncMutation, removeMutation),
    connecting: connectMutation.isPending,
    refetch,
    connectWallet,
    syncWallet,
    removeWallet,
    history: historyQuery.data ?? null,
    savingHolding: saveHoldingMutation.isPending,
    saveHolding,
    removeHolding,
    importing: importMutation.isPending,
    importExchangeCsv,
    gains: gainsQuery.data ?? null,
    gainsYear,
    setGainsYear,
  };
}
