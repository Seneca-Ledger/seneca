'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import apiClient from '@/app/lib/api';
import { checkContract } from '@/app/lib/query-fn-schema';
import { isAbortError } from '../utils/pasteUtils';
import type { CustomTableGridRow } from '../utils/types';

const getRowIdentity = (row: unknown): string => {
  if (!row || typeof row !== 'object') {
    return '';
  }
  const record = row as Record<string, unknown>;
  if (typeof record.id === 'string') {
    return record.id;
  }
  if (typeof record.rowNumber === 'number') {
    return String(record.rowNumber);
  }
  return '';
};

export interface TableSortState {
  col: string;
  dir: 'asc' | 'desc';
}

export interface UseTableGridReturn {
  rows: CustomTableGridRow[];
  setRows: React.Dispatch<React.SetStateAction<CustomTableGridRow[]>>;
  loadingRows: boolean;
  hasMore: boolean;
  /** Server-side total for the current filters; null until the first reply. */
  total: number | null;
  loadRows: (opts?: { reset?: boolean; filtersParam?: string }) => Promise<void>;
}

interface UseTableGridParams {
  tableId: string | null;
  isAuthenticated: boolean;
  combinedFiltersParam: string | undefined;
  sort?: TableSortState | null;
  loadRowsFailedMessage: string;
}

export function useTableGrid({
  tableId,
  isAuthenticated,
  combinedFiltersParam,
  sort,
  loadRowsFailedMessage,
}: UseTableGridParams): UseTableGridReturn {
  const [rows, setRows] = useState<CustomTableGridRow[]>([]);
  // Loading from the start, so the grid shows its skeleton, not the empty state,
  // before the first request goes out.
  const [loadingRows, setLoadingRows] = useState(Boolean(tableId));
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState<number | null>(null);

  const rowsRef = useRef<CustomTableGridRow[]>([]);
  const rowsRequestSeqRef = useRef(0);
  const rowsAbortControllerRef = useRef<AbortController | null>(null);
  const loadingRowsRef = useRef(false);
  const combinedFiltersRef = useRef<string | undefined>(undefined);
  const sortRef = useRef<TableSortState | null | undefined>(sort);

  // Сортировка сериализуется в строку, чтобы не перезапускать загрузку
  // на каждый новый литерал объекта с теми же полями.
  const sortParam = sort ? JSON.stringify({ col: sort.col, dir: sort.dir }) : undefined;

  useEffect(() => {
    sortRef.current = sort;
  }, [sort]);

  // Keep rowsRef in sync for cursor-based pagination
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  // Keep combinedFiltersRef in sync for use inside loadRows
  useEffect(() => {
    combinedFiltersRef.current = combinedFiltersParam;
  }, [combinedFiltersParam]);

  const isStaleRequest = (controller: AbortController, requestId: number): boolean =>
    controller.signal.aborted || requestId !== rowsRequestSeqRef.current;

  const cleanupLoadState = (controller: AbortController, requestId: number): void => {
    if (requestId === rowsRequestSeqRef.current) {
      loadingRowsRef.current = false;
      setLoadingRows(false);
    }
    if (rowsAbortControllerRef.current === controller) {
      rowsAbortControllerRef.current = null;
    }
  };

  const dedupeRows = <T>(merged: T[]): T[] => {
    const seen = new Set<string>();
    const result: T[] = [];
    for (const row of merged) {
      const id = getRowIdentity(row);
      if (!id || seen.has(id)) {
        continue;
      }
      seen.add(id);
      result.push(row);
    }
    return result;
  };

  const applyFetchedRows = (fetched: unknown[], reset: boolean): void => {
    if (reset) {
      setRows(() => dedupeRows(fetched as CustomTableGridRow[]));
    } else {
      setRows(prev => dedupeRows([...prev, ...(fetched as CustomTableGridRow[])]));
    }
  };

  const handleLoadError = (error: unknown): void => {
    if (!isAbortError(error)) {
      console.error('Failed to load rows:', error);
      toast.error(loadRowsFailedMessage);
    }
  };

  const canStartLoad = (shouldReset: boolean): boolean => {
    if (!tableId) {
      return false;
    }
    return shouldReset || !loadingRowsRef.current;
  };

  const loadRows = useCallback(
    async (opts?: { reset?: boolean; filtersParam?: string }) => {
      const shouldReset = Boolean(opts?.reset);
      if (!canStartLoad(shouldReset)) {
        return;
      }

      rowsRequestSeqRef.current += 1;
      const requestId = rowsRequestSeqRef.current;
      if (shouldReset) {
        rowsAbortControllerRef.current?.abort();
      }

      const controller = new AbortController();
      rowsAbortControllerRef.current = controller;
      loadingRowsRef.current = true;
      setLoadingRows(true);

      const filters = opts?.filtersParam ?? combinedFiltersRef.current;
      const activeSort = sortRef.current;
      // При произвольной сортировке keyset-курсор по rowNumber неверен:
      // порядок больше не совпадает с полем курсора, поэтому идём смещением.
      const cursor = activeSort || shouldReset ? undefined : rowsRef.current.at(-1)?.rowNumber;
      const offset = activeSort && !shouldReset ? rowsRef.current.length : undefined;

      return await (async () => {
        const response = await apiClient.get(`/custom-tables/${tableId}/rows`, {
          signal: controller.signal,
          params: {
            cursor,
            offset,
            limit: 50,
            filters,
            sort: activeSort
              ? JSON.stringify({ col: activeSort.col, dir: activeSort.dir })
              : undefined,
          },
        });
        const page = await checkContract(
          'CustomTableRowPage',
          response.data,
          '/custom-tables/:id/rows',
        );
        if (isStaleRequest(controller, requestId)) {
          return;
        }
        const next = page.items;
        applyFetchedRows(next, shouldReset);
        setTotal(page.meta.total);
        setHasMore(next.length >= 50);
      })()
        .catch(async error => {
          handleLoadError(error);
        })
        .finally(async () => {
          cleanupLoadState(controller, requestId);
        });
    },
    // Помощники пересоздаются каждый рендер, поэтому в зависимостях лежат
    // только значения, которые они замыкают: иначе loadRows меняет идентичность
    // на каждый рендер и эффект сброса ниже уходит в бесконечный цикл.
    [tableId, loadRowsFailedMessage], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Reset and reload when filters, sort or tableId changes
  useEffect(() => {
    if (!(isAuthenticated && tableId)) {
      return;
    }
    setHasMore(true);
    setRows([]);
    const timer = window.setTimeout(() => {
      loadRows({ reset: true, filtersParam: combinedFiltersParam });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [combinedFiltersParam, sortParam, loadRows, tableId, isAuthenticated]);

  // Abort in-flight requests on unmount
  useEffect(() => {
    return () => {
      rowsAbortControllerRef.current?.abort();
    };
  }, []);

  return { rows, setRows, loadingRows, hasMore, total, loadRows };
}
