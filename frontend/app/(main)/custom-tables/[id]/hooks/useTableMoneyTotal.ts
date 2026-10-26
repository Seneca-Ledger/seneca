'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/app/lib/api';
import type { ContractType } from '@/app/lib/query-fn-schema';
import { checkContract } from '@/app/lib/query-fn-schema';
import { isAbortError } from '../utils/pasteUtils';

export type TableMoneyTotal = ContractType<'CustomTableMoneyTotal'>;

interface UseTableMoneyTotalParams {
  tableId: string | null;
  isAuthenticated: boolean;
  /** Меняется после правок строк, чтобы пересчитать итог. */
  refreshToken?: number;
}

/** The table's balance under its title: every row, whatever the grid's filters. */
export function useTableMoneyTotal({
  tableId,
  isAuthenticated,
  refreshToken = 0,
}: UseTableMoneyTotalParams): TableMoneyTotal | null {
  const [value, setValue] = useState<TableMoneyTotal | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshToken only triggers a reload.
  useEffect(() => {
    if (!(tableId && isAuthenticated)) {
      setValue(null);
      return;
    }
    const controller = new AbortController();
    apiClient
      .get(`/custom-tables/${tableId}/money-total`, { signal: controller.signal })
      .then(response =>
        checkContract('CustomTableMoneyTotal', response.data, '/custom-tables/:id/money-total'),
      )
      .then(next => {
        if (!controller.signal.aborted) {
          setValue(next);
        }
      })
      .catch(error => {
        if (!isAbortError(error)) {
          console.error('Failed to load table money total:', error);
        }
      });
    return () => controller.abort();
  }, [tableId, isAuthenticated, refreshToken]);

  return value;
}
