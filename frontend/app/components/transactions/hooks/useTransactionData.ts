'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { apiQuery } from '@/app/lib/query-fn';
import { queryKeys } from '@/app/lib/query-keys';

import { mapApiRecordToTransaction, type TransactionApiRecord } from '../helpers/transactionMapper';
import type { Category, Transaction } from '../types';

export interface UseTransactionDataOptions {
  showConverted: boolean;
  workspaceCurrency: string;
  currencyFilter: string | null;
  /** `me`, `shared`, a membership id, or null for the whole workspace. */
  owner?: string | null;
  /** YYYY-MM-DD, inclusive. */
  startDate?: string | null;
  /** YYYY-MM-DD, inclusive. */
  endDate?: string | null;
}

export interface UseTransactionDataResult {
  transactions: Transaction[];
  categories: Category[];
  isPending: boolean;
  isError: boolean;
  error: string | null;
  refetch: () => void;
}

interface TransactionsPayload {
  data?: TransactionApiRecord[];
  items?: TransactionApiRecord[];
}

/** Категории не зависят от фильтров, валюты и дат — отдельный ключ и свой staleTime. */
const CATEGORIES_STALE_TIME = 5 * 60_000;

export function useTransactionData({
  showConverted,
  workspaceCurrency,
  currencyFilter,
  owner,
  startDate,
  endDate,
}: UseTransactionDataOptions): UseTransactionDataResult {
  const workspaceId = useWorkspaceId();

  const params: Record<string, string | number> = { limit: 500 };
  if (showConverted) params.convert_to = workspaceCurrency;
  if (currencyFilter) params.currency = currencyFilter;
  if (owner) params.owner = owner;
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;

  const transactionsQuery = useQuery({
    queryKey: queryKeys.transactions({ workspaceId, params }),
    // Нормализация и маппинг живут в queryFn, а не в select: structural sharing
    // применяется к уже отображённому массиву, поэтому неизменившийся рефетч
    // отдаёт тот же референс и таблица ниже не перестраивается.
    queryFn: async ({ signal }) => {
      const payload = await apiQuery<TransactionsPayload | TransactionApiRecord[]>({
        url: '/transactions',
        params,
        signal,
      });
      const raw = Array.isArray(payload) ? payload : (payload?.data ?? payload?.items ?? []);
      return raw.map(mapApiRecordToTransaction);
    },
  });

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories(workspaceId),
    queryFn: ({ signal }) => apiQuery<Category[]>({ url: '/categories', signal }),
    staleTime: CATEGORIES_STALE_TIME,
  });

  const refetch = useCallback((): void => {
    void transactionsQuery.refetch();
    void categoriesQuery.refetch();
  }, [transactionsQuery.refetch, categoriesQuery.refetch]);

  const isError = transactionsQuery.isError || categoriesQuery.isError;

  return {
    transactions: transactionsQuery.data ?? [],
    categories: categoriesQuery.data ?? [],
    isPending: transactionsQuery.isPending || categoriesQuery.isPending,
    isError,
    // Тост убран: с ретраями он всплывал бы повторно, а TransactionTab и так
    // рендерит ошибку инлайном.
    error: isError
      ? getApiErrorMessage(
          transactionsQuery.error ?? categoriesQuery.error,
          'Failed to load transactions',
        )
      : null,
    refetch,
  };
}
