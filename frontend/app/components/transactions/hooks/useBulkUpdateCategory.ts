'use client';

import { type UseMutationResult, useMutation } from '@tanstack/react-query';
import api from '@/app/lib/api';
import { invalidateFinancialData } from '@/app/lib/invalidate-document-lists';
import type { ContractInput } from '@/app/lib/query-fn-schema';

export interface BulkUpdateCategoryVariables {
  txIds: string[];
  categoryId: string;
}

/**
 * Массовая смена категории. invalidateFinancialData заменяет ручной refetch():
 * обновляет любой смонтированный список транзакций и всё, что из них
 * считается (дашборд, отчёты, бюджеты), а не только список, откуда пришёл вызов.
 */
export function useBulkUpdateCategory(): UseMutationResult<
  unknown,
  Error,
  BulkUpdateCategoryVariables
> {
  return useMutation({
    mutationFn: async ({ txIds, categoryId }: BulkUpdateCategoryVariables) => {
      await api.post('/transactions/bulk-update', {
        items: txIds.map(id => ({ id, updates: { categoryId } })),
      } satisfies ContractInput<'BulkUpdateRequestBody'>);
    },
    // A category moves the row between budgets, reports and the dashboard too.
    onSuccess: () => {
      invalidateFinancialData();
    },
  });
}
