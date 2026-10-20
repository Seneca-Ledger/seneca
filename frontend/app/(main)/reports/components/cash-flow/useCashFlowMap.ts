'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useViewPreference } from '@/app/components/transactions/hooks/useViewPreference';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
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

/** The one switch the page remembers: on unless this person turned it off. */
function readReportsView(saved: Readonly<Record<string, unknown>>): { includeTransfers: boolean } {
  return {
    includeTransfers: typeof saved.includeTransfers === 'boolean' ? saved.includeTransfers : true,
  };
}

export function useCashFlowMap() {
  const workspaceId = useWorkspaceId();
  const view = useViewPreference('reports', readReportsView);
  const includeTransfers = view.state?.includeTransfers ?? true;
  const [local, setLocal] = useState<Omit<CashFlowFilters, 'includeTransfers'>>(() => {
    const [from, to] = presetRangeValues(PERIOD_PRESETS[0]);
    return { from, to, compare: true, categories: [], owner: null };
  });
  const filters = useMemo<CashFlowFilters>(
    () => ({ ...local, includeTransfers }),
    [local, includeTransfers],
  );

  const params = useMemo(() => {
    return {
      dateFrom: filters.from,
      dateTo: filters.to,
      ...(filters.compare ? { compare: true } : {}),
      ...(filters.includeTransfers ? { includeTransfers: true } : {}),
      ...(filters.categories.length > 0 ? { categories: filters.categories.join(',') } : {}),
      ...(filters.owner ? { owner: filters.owner } : {}),
    } satisfies ContractInput<'CashFlowMapQuery'>;
  }, [filters]);

  const query = useQuery({
    queryKey: queryKeys.cashFlowMap({ workspaceId, params: JSON.stringify(params) }),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/reports/cash-flow-map', params, signal, contract: 'CashFlowMap' }),
    enabled: Boolean(workspaceId),
    placeholderData: previous => previous,
  });

  const { save } = view;
  const update = useCallback(
    (patch: Partial<CashFlowFilters>) => {
      const { includeTransfers: nextIncludeTransfers, ...rest } = patch;
      // Saved per person and workspace, so leaving the page does not reset it.
      if (nextIncludeTransfers !== undefined) save({ includeTransfers: nextIncludeTransfers });
      setLocal(current => ({ ...current, ...rest }));
    },
    [save],
  );

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
