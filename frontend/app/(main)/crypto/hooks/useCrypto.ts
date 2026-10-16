'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import apiClient from '@/app/lib/api';
import { getApiErrorStatus } from '@/app/lib/api-error';
import type {
  ChainFamily,
  CryptoGains,
  CryptoHistory,
  CryptoNetwork,
  CryptoSummary,
  CryptoTransaction,
  CryptoWallet,
  SupportedChainId,
} from '@/app/lib/contracts';
import { unwrapEnvelope } from '@/app/lib/query-fn';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { apiQueryDecoded, checkContract } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

export type {
  ChainFamily,
  CryptoDisposal,
  CryptoGains,
  CryptoHistory,
  CryptoHolding,
  CryptoNetwork,
  CryptoSummary,
  CryptoTransaction,
  CryptoWallet,
  CryptoWalletBalance,
  CryptoWalletKind,
} from '@/app/lib/contracts';

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
  connectWallet: (
    address: string,
    label?: string,
    chainIds?: SupportedChainId[],
  ) => Promise<boolean>;
  syncWallet: (id: string) => void;
  removeWallet: (id: string) => void;
  history: CryptoHistory | null;
  historyDays: CryptoHistoryDays;
  setHistoryDays: (days: CryptoHistoryDays) => void;
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

/** The chart's periods: a month, a quarter, a year. */
export const CRYPTO_HISTORY_DAYS = [30, 90, 365] as const;
export type CryptoHistoryDays = (typeof CRYPTO_HISTORY_DAYS)[number];

export function useCrypto(): UseCryptoState {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();

  const walletsQuery = useQuery({
    queryKey: queryKeys.cryptoWallets(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/crypto/wallets', signal, contract: 'CryptoWalletList' }),
  });

  const summaryQuery = useQuery({
    queryKey: queryKeys.cryptoSummary(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/crypto/summary', signal, contract: 'CryptoSummary' }),
  });

  const transactionsQuery = useQuery({
    queryKey: queryKeys.cryptoTransactions(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/crypto/transactions', signal, contract: 'CryptoTransactionList' }),
  });

  // The period goes into the key under the shared prefix, so invalidating the
  // history still reaches every period.
  const [historyDays, setHistoryDays] = useState<CryptoHistoryDays>(90);
  const historyQuery = useQuery({
    queryKey: [...queryKeys.cryptoHistory(workspaceId), historyDays],
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: `/crypto/history?days=${historyDays}`,
        signal,
        contract: 'CryptoHistory',
      }),
    // The line stays on screen while another period loads.
    placeholderData: previous => previous,
  });

  // Год приходит в ключ запроса: смена года — другой запрос, а не ручная перезагрузка.
  const [gainsYear, setGainsYear] = useState<number | null>(null);
  const gainsQuery = useQuery({
    queryKey: queryKeys.cryptoGains(workspaceId, gainsYear),
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: '/crypto/gains',
        params: gainsYear ? { year: gainsYear } : undefined,
        signal,
        contract: 'CryptoGains',
      }),
  });

  // Список сетей статичен на сервере — один запрос на сессию.
  const networksQuery = useQuery({
    queryKey: queryKeys.cryptoNetworks(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/crypto/networks', signal, contract: 'CryptoNetworkList' }),
    staleTime: Number.POSITIVE_INFINITY,
  });

  // Общий префикс ключа: одна инвалидация сметает и кошельки, и сводку.
  const invalidateCrypto = useCallback((): Promise<void> => {
    return queryClient.invalidateQueries({ queryKey: ['crypto'] });
  }, [queryClient]);

  const connectMutation = useMutation({
    mutationFn: async (variables: {
      address: string;
      label?: string;
      chainIds?: SupportedChainId[];
    }) => {
      await apiClient.post('/crypto/wallets', {
        address: variables.address,
        chainIds: variables.chainIds,
        label: variables.label?.trim() ? variables.label.trim() : undefined,
      } satisfies ContractInput<'ConnectCryptoWalletBody'>);
    },
    onSuccess: invalidateCrypto,
  });

  const syncMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/crypto/wallets/${id}/sync`);
    },
    onSuccess: invalidateCrypto,
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/crypto/wallets/${id}`);
    },
    onSuccess: invalidateCrypto,
  });

  const importMutation = useMutation({
    mutationFn: async (file: File): Promise<ExchangeImportResult> => {
      const form = new FormData();
      form.append('file', file);
      const response = await apiClient.post('/crypto/import', form);
      return checkContract('ExchangeImportResult', unwrapEnvelope(response.data), '/crypto/import');
    },
    onSuccess: invalidateCrypto,
  });

  const saveHoldingMutation = useMutation({
    mutationFn: async (holding: ManualHoldingInput) => {
      await apiClient.post(
        '/crypto/holdings',
        holding satisfies ContractInput<'ManualHoldingBody'>,
      );
    },
    onSuccess: invalidateCrypto,
  });

  const removeHoldingMutation = useMutation({
    mutationFn: async (asset: string) => {
      await apiClient.delete(`/crypto/holdings/${asset}`);
    },
    onSuccess: invalidateCrypto,
  });

  const connectWallet = useCallback(
    async (address: string, label?: string, chainIds?: SupportedChainId[]): Promise<boolean> => {
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
    historyDays,
    setHistoryDays,
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
