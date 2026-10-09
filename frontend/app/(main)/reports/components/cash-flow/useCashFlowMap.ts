'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { apiQuery } from '@/app/lib/query-fn';
import { queryKeys } from '@/app/lib/query-keys';
import { PERIOD_PRESETS, presetRangeValues } from '../report-period-presets';

export interface CashFlowCategory {
  id: string;
  name: string;
  amount: number;
  previousAmount: number | null;
  children: Array<{ id: string; name: string; amount: number; previousAmount: number | null }>;
}

export interface CashFlowMapData {
  currency: string;
  period: { from: string; to: string };
  previousPeriod: { from: string; to: string } | null;
  includeTransfers: boolean;
  availableCategories: Array<{ id: string; name: string; parentId: string | null }>;
  income: { total: number; sources: Array<{ name: string; amount: number }> };
  expense: { total: number; categories: CashFlowCategory[] };
  transfers: number;
  net: number;
  previous: { income: number; expense: number; net: number } | null;
  sankey: {
    nodes: Array<{
      id: string;
      name: string;
      kind: 'source' | 'balance' | 'total' | 'category' | 'subcategory' | 'transfers' | 'saved';
    }>;
    links: Array<{ source: string; target: string; value: number }>;
  };
  treemap: Array<{
    id: string;
    name: string;
    value: number;
    children: Array<{ id: string; name: string; value: number }>;
  }>;
}

export interface CashFlowFilters {
  from: string;
  to: string;
  compare: boolean;
  includeTransfers: boolean;
  /** Empty = every category. */
  categories: string[];
  /** `me`, `shared`, a membership id, or null for the whole household. */
  owner: string | null;
}

export function useCashFlowMap() {
  const workspaceId = useWorkspaceId();
  const [filters, setFilters] = useState<CashFlowFilters>(() => {
    const [from, to] = presetRangeValues(PERIOD_PRESETS[0]);
    return { from, to, compare: true, includeTransfers: false, categories: [], owner: null };
  });

  const params = useMemo(() => {
    const query: Record<string, string | boolean> = { dateFrom: filters.from, dateTo: filters.to };
    if (filters.compare) query.compare = true;
    if (filters.includeTransfers) query.includeTransfers = true;
    if (filters.categories.length > 0) query.categories = filters.categories.join(',');
    if (filters.owner) query.owner = filters.owner;
    return query;
  }, [filters]);

  const query = useQuery({
    queryKey: queryKeys.cashFlowMap({ workspaceId, params: JSON.stringify(params) }),
    queryFn: ({ signal }) =>
      apiQuery<CashFlowMapData>({ url: '/reports/cash-flow-map', params, signal }),
    enabled: Boolean(workspaceId),
    placeholderData: previous => previous,
  });

  const update = useCallback((patch: Partial<CashFlowFilters>) => {
    setFilters(current => ({ ...current, ...patch }));
  }, []);

  const exportUrl = useMemo(() => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) search.set(key, String(value));
    search.set('format', 'csv');
    return `/reports/cash-flow-map?${search.toString()}`;
  }, [params]);

  return {
    data: query.data ?? null,
    isPending: query.isPending,
    isFetching: query.isFetching,
    error: query.error ? String(query.error) : null,
    filters,
    update,
    exportUrl,
  };
}
