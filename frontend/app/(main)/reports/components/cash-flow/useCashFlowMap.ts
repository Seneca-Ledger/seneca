'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { useViewPreference } from '@/app/components/transactions/hooks/useViewPreference';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { presetRangeValues, QUICK_PERIOD_PRESETS } from '../report-period-presets';

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
  /** Whether refunds were taken off their category instead of counted as income. */
  netRefunds: boolean;
  /** Currencies left out of every figure because no rate was found for their day. */
  missingRates: string[];
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
    icon: string | null;
    value: number;
    children: Array<{ id: string; name: string; icon: string | null; value: number }>;
  }>;
}

export interface CashFlowFilters {
  from: string;
  to: string;
  compare: boolean;
  /** The earlier window: the one just before, or the same dates last year. */
  compareTo: 'previous' | 'year';
  includeTransfers: boolean;
  netRefunds: boolean;
  /** Empty = every category. */
  categories: string[];
  /** `me`, `shared`, a membership id, or null for the whole household. */
  owner: string | null;
}

type SavedSwitches = Pick<CashFlowFilters, 'includeTransfers' | 'netRefunds'>;

/**
 * The switches the page remembers: transfers on unless this person turned them
 * off, refunds netted only when they asked, so the figures match the dashboard.
 */
function readReportsView(saved: Readonly<Record<string, unknown>>): SavedSwitches {
  return {
    includeTransfers: typeof saved.includeTransfers === 'boolean' ? saved.includeTransfers : true,
    netRefunds: saved.netRefunds === true,
  };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function useCashFlowMap() {
  const workspaceId = useWorkspaceId();
  const searchParams = useSearchParams();
  const view = useViewPreference('reports', readReportsView);
  const includeTransfers = view.state?.includeTransfers ?? true;
  const netRefunds = view.state?.netRefunds ?? false;
  const [local, setLocal] = useState<Omit<CashFlowFilters, keyof SavedSwitches>>(() => {
    // A link may name the period (`?from=&to=`, the dashboard's month); else the first preset.
    const linkedFrom = searchParams?.get('from') ?? '';
    const linkedTo = searchParams?.get('to') ?? '';
    const [from, to] =
      DAY.test(linkedFrom) && DAY.test(linkedTo) && linkedFrom <= linkedTo
        ? [linkedFrom, linkedTo]
        : presetRangeValues(QUICK_PERIOD_PRESETS[0]);
    return { from, to, compare: true, compareTo: 'previous', categories: [], owner: null };
  });
  const filters = useMemo<CashFlowFilters>(
    () => ({ ...local, includeTransfers, netRefunds }),
    [local, includeTransfers, netRefunds],
  );

  const params = useMemo(() => {
    return {
      dateFrom: filters.from,
      dateTo: filters.to,
      ...(filters.compare ? { compare: true } : {}),
      ...(filters.compare && filters.compareTo === 'year' ? { compareTo: 'year' as const } : {}),
      ...(filters.includeTransfers ? { includeTransfers: true } : {}),
      ...(filters.netRefunds ? { netRefunds: true } : {}),
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
      const { includeTransfers: nextIncludeTransfers, netRefunds: nextNetRefunds, ...rest } = patch;
      // Saved per person and workspace, so leaving the page does not reset them.
      if (nextIncludeTransfers !== undefined || nextNetRefunds !== undefined) {
        save({
          includeTransfers: nextIncludeTransfers ?? includeTransfers,
          netRefunds: nextNetRefunds ?? netRefunds,
        });
      }
      setLocal(current => ({ ...current, ...rest }));
    },
    [save, includeTransfers, netRefunds],
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
