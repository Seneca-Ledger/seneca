'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { apiQuery } from '@/app/lib/query-fn';
import { queryKeys } from '@/app/lib/query-keys';
import { rememberRowCount } from '../rowCountMemory';

export interface TableCategory {
  id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
}

export interface TableListItem {
  id: string;
  name: string;
  description: string | null;
  source: string;
  sourceDetails?: string | null;
  /** Set when the table was filled from app data and can be refreshed. */
  sourceBinding?: {
    kind: string;
    filters: Record<string, unknown>;
    syncedAt: string | null;
  } | null;
  categoryId?: string | null;
  category?: TableCategory | null;
  createdAt: string;
  updatedAt: string;
  /** Filled lazily from GET /rows meta.total. */
  rowsCount?: number;
}

export type SourceFilter = 'all' | 'manual';

const PAGE_SIZE = 20;

/** The list endpoints answer either with a bare array or with `{ items }`. */
const readList = <T>(payload: unknown): T[] => {
  if (Array.isArray(payload)) {
    return payload as T[];
  }
  const items = (payload as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as T[]) : [];
};

interface UseTablesListParams {
  enabled: boolean;
  messages: { loadFailed: string; deleted: string; deleteFailed: string };
}

/** Tables of the current workspace with client-side search, filter and paging. */
export function useTablesList({ enabled, messages }: UseTablesListParams) {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const [rowsCounts, setRowsCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [page, setPage] = useState(1);

  const tablesQuery = useQuery({
    queryKey: queryKeys.customTables(workspaceId),
    queryFn: async ({ signal }) =>
      readList<TableListItem>(await apiQuery<unknown>({ url: '/custom-tables', signal })),
    enabled: enabled && Boolean(workspaceId),
  });
  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories(workspaceId),
    queryFn: async ({ signal }) =>
      readList<TableCategory>(await apiQuery<unknown>({ url: '/categories', signal })),
    enabled: enabled && Boolean(workspaceId),
  });

  const loadFailed = tablesQuery.isError;
  useEffect(() => {
    if (loadFailed) {
      toast.error(getApiErrorMessage(tablesQuery.error, messages.loadFailed), {
        id: 'custom-tables-load',
      });
    }
  }, [loadFailed, tablesQuery.error, messages.loadFailed]);

  const items: TableListItem[] = tablesQuery.data ?? [];
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items
      .filter(item => sourceFilter === 'all' || item.source === sourceFilter)
      .filter(
        item =>
          !q ||
          item.name.toLowerCase().includes(q) ||
          (item.description ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [items, searchQuery, sourceFilter]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, sourceFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = useMemo(() => {
    const start = (Math.min(page, totalPages) - 1) * PAGE_SIZE;
    return filtered
      .slice(start, start + PAGE_SIZE)
      .map(item => ({ ...item, rowsCount: rowsCounts[item.id] }));
  }, [filtered, page, totalPages, rowsCounts]);

  // Row counts come from a one-row page per table; only the visible page is asked.
  useEffect(() => {
    const missing = pageItems.filter(item => rowsCounts[item.id] === undefined);
    if (!missing.length) {
      return;
    }
    let cancelled = false;
    void Promise.all(
      missing.map(item =>
        apiClient
          .get(`/custom-tables/${item.id}/rows`, { params: { limit: 1 } })
          .then(response => {
            const total = Number(response.data?.meta?.total) || 0;
            // Seeds the table page's skeleton, so even a first open draws the right rows.
            rememberRowCount(item.id, total);
            return [item.id, total] as const;
          })
          .catch(() => [item.id, 0] as const),
      ),
    ).then(entries => {
      if (!cancelled) {
        setRowsCounts(prev => ({ ...prev, ...Object.fromEntries(entries) }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pageItems, rowsCounts]);

  const reload = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.customTables(workspaceId) }),
    [queryClient, workspaceId],
  );

  const deleteTable = useCallback(
    async (id: string) => {
      await (async () => {
        await apiClient.delete(`/custom-tables/${id}`);
        queryClient.setQueryData<TableListItem[]>(queryKeys.customTables(workspaceId), prev =>
          (prev ?? []).filter(item => item.id !== id),
        );
        toast.success(messages.deleted);
      })().catch(async error => {
        toast.error(getApiErrorMessage(error, messages.deleteFailed));
      });
    },
    [queryClient, workspaceId, messages.deleted, messages.deleteFailed],
  );

  return {
    items: pageItems,
    totalCount: filtered.length,
    loading: tablesQuery.isPending,
    categories: categoriesQuery.data ?? [],
    searchQuery,
    setSearchQuery,
    sourceFilter,
    setSourceFilter,
    page: Math.min(page, totalPages),
    totalPages,
    setPage,
    reload,
    deleteTable,
  };
}
