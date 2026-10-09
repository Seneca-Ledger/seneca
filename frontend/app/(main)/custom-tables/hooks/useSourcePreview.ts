'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import apiClient from '@/app/lib/api';
import { unwrapEnvelope } from '@/app/lib/query-fn';
import { queryKeys } from '@/app/lib/query-keys';
import { normalizeSourceFilters, type SourceFilters, type SourceKind } from '../sources';

export interface SourcePreview {
  count: number;
  columns: Array<{ field: string; title: string; type: string }>;
  rows: Array<Record<string, string | number | boolean | null>>;
}

const DEBOUNCE_MS = 300;

/** Row count and a sample for the chosen source; filters are debounced while the user types. */
export function useSourcePreview(params: {
  kind: SourceKind | null;
  filters: SourceFilters;
  columnTitles: Record<string, string>;
}) {
  const workspaceId = useWorkspaceId();
  const [debounced, setDebounced] = useState(params.filters);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(params.filters), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [params.filters]);

  const filters = normalizeSourceFilters(debounced);
  const query = useQuery({
    queryKey: [...queryKeys.customTables(workspaceId), 'source-preview', params.kind, filters],
    queryFn: async ({ signal }) => {
      const response = await apiClient.post(
        '/custom-tables/source-preview',
        { kind: params.kind, filters, columnTitles: params.columnTitles },
        { signal },
      );
      return unwrapEnvelope<SourcePreview>(response.data);
    },
    enabled: Boolean(params.kind && workspaceId),
    placeholderData: keepPreviousData,
  });

  return {
    preview: query.data ?? null,
    loading: query.isFetching,
    error: query.isError,
  };
}
