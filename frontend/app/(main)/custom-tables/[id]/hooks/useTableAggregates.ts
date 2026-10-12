'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import apiClient from '@/app/lib/api';
import { checkContract } from '@/app/lib/query-fn-schema';
import { isAbortError } from '../utils/pasteUtils';

export const AGGREGATE_FNS = ['sum', 'avg', 'min', 'max', 'count'] as const;

export type AggregateFn = (typeof AGGREGATE_FNS)[number];

export type AggregateSelection = Record<string, AggregateFn>;

export type AggregateValues = Record<string, number | string | null>;

interface UseTableAggregatesParams {
  tableId: string | null;
  isAuthenticated: boolean;
  /** Те же фильтры, что применены к гриду: итог обязан совпадать с выборкой. */
  combinedFiltersParam: string | undefined;
  selection: AggregateSelection;
  /** Меняется после правок строк, чтобы пересчитать итоги. */
  refreshToken?: number;
}

export interface UseTableAggregatesReturn {
  values: AggregateValues;
  loading: boolean;
}

export function useTableAggregates({
  tableId,
  isAuthenticated,
  combinedFiltersParam,
  selection,
  refreshToken = 0,
}: UseTableAggregatesParams): UseTableAggregatesReturn {
  const [values, setValues] = useState<AggregateValues>({});
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Сериализуем выбор, иначе новый объект на каждый рендер перезапускал бы запрос.
  const aggsParam = Object.entries(selection)
    .map(([col, fn]) => ({ col, fn }))
    .sort((a, b) => a.col.localeCompare(b.col));
  const aggsKey = aggsParam.length ? JSON.stringify(aggsParam) : '';

  const load = useCallback(async () => {
    if (!(tableId && isAuthenticated && aggsKey)) {
      setValues({});
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    return await (async () => {
      const response = await apiClient.get(`/custom-tables/${tableId}/aggregates`, {
        signal: controller.signal,
        params: { aggs: aggsKey, filters: combinedFiltersParam },
      });
      const page = await checkContract(
        'CustomTableAggregates',
        response.data,
        '/custom-tables/:id/aggregates',
      );
      if (controller.signal.aborted) {
        return;
      }
      const next: AggregateValues = {};
      for (const item of page.items) {
        next[item.col] = item.value;
      }
      setValues(next);
    })()
      .catch(async error => {
        if (!isAbortError(error)) {
          console.error('Failed to load table aggregates:', error);
        }
      })
      .finally(async () => {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setLoading(false);
        }
      });
  }, [tableId, isAuthenticated, aggsKey, combinedFiltersParam]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { values, loading };
}
