'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import apiClient from '@/app/lib/api';
import { apiQuery } from '@/app/lib/query-fn';
import { queryKeys } from '@/app/lib/query-keys';

export type NetWorthRange = '1d' | '30d' | '90d' | '180d' | 'ytd' | '1y' | '3y' | '5y' | 'all';

export const NET_WORTH_RANGES: NetWorthRange[] = [
  '1d',
  '30d',
  '90d',
  '180d',
  'ytd',
  '1y',
  '3y',
  '5y',
  'all',
];

/** Which shape of the same window the user is looking at. */
export type NetWorthView = 'performance' | 'breakdown';

/** A window of the user's own choosing, which overrides the preset. */
export interface NetWorthCustomRange {
  from: string;
  to: string;
}

export interface NetWorthPoint {
  date: string;
  value: number;
  assets: number;
  liabilities: number;
}

export interface NetWorthBreakdownItem {
  code: string;
  name: string;
  amount: number;
  percent: number;
}

export type CapitalRole = 'income' | 'neutral' | 'drain';
export type RiskLevel = 'low' | 'medium' | 'high';

export const CAPITAL_ROLES: CapitalRole[] = ['income', 'neutral', 'drain'];
export const RISK_LEVELS: RiskLevel[] = ['low', 'medium', 'high'];

/** The share of assets above which the 80/20 rule is considered broken. */
export const RISKY_ALLOCATION_THRESHOLD = 20;

/** What one line, or the rates, did to the number over the window. */
export interface NetWorthAttributionRow {
  id: string;
  code: string;
  name: string;
  amount: number;
}

export type NetWorthChangeKind = 'money' | 'revaluation' | 'fx';

export interface NetWorthAttribution {
  byAccount: NetWorthAttributionRow[];
  byKind: Array<{ kind: NetWorthChangeKind; amount: number }>;
}

export interface NetWorthClassificationItem {
  key: string | null;
  amount: number;
  percent: number;
}

export interface NetWorthAssetLine {
  id: string;
  code: string;
  name: string;
  amount: number;
  capitalRole: CapitalRole | null;
  riskLevel: RiskLevel | null;
  isClassifiable: boolean;
}

export interface NetWorthData {
  range: NetWorthRange;
  /** The window actually charted, whichever way it was chosen. */
  from: string;
  to: string;
  currency: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number | null;
  assetsTotal: number;
  liabilitiesTotal: number;
  series: NetWorthPoint[];
  breakdown: NetWorthBreakdownItem[];
  byRisk: NetWorthClassificationItem[];
  byRole: NetWorthClassificationItem[];
  riskyPercent: number;
  assetLines: NetWorthAssetLine[];
  /** Currencies left out of the figures because no exchange rate was found. */
  missingRates?: string[];
  /** The highest sampled net worth over the whole history, and when. */
  allTimeHigh?: { value: number; date: string } | null;
  /** Investment holdings by asset class, plus cash and the other sheet lines. */
  byAssetClass?: NetWorthClassificationItem[];
  /** What made the change over the window. */
  attribution?: NetWorthAttribution;
  /** What came in over the window and the share of it kept. */
  savings?: { income: number; kept: number; rate: number | null };
  /** The same figures in troy ounces of a metal; only when asked for. */
  denominated?: NetWorthDenominated | null;
}

/** Net worth measured in metal: what the money figures buy in ounces. */
export interface NetWorthDenominated {
  metal: 'XAU' | 'XAG' | 'XPT' | 'XPD';
  unit: 'ozt';
  current: number;
  previous: number;
  change: number;
  changePercent: number | null;
  series: NetWorthPoint[];
}

export type ClassificationPatch = {
  capitalRole?: CapitalRole | null;
  riskLevel?: RiskLevel | null;
};

interface NetWorthState {
  data: NetWorthData | undefined;
  isPending: boolean;
  isFetching: boolean;
  error: boolean;
  range: NetWorthRange;
  custom: NetWorthCustomRange | null;
  view: NetWorthView;
  /** Account ids the user has taken off the page. */
  excluded: string[];
  setRange: (range: NetWorthRange) => void;
  setCustom: (custom: NetWorthCustomRange | null) => void;
  setView: (view: NetWorthView) => void;
  setExcluded: (ids: string[]) => void;
  /** Null shows money; a metal shows the same net worth in its ounces. */
  denominate: 'XAU' | null;
  setDenominate: (metal: 'XAU' | null) => void;
  refetch: () => void;
  classify: (accountId: string, patch: ClassificationPatch) => void;
}

function applyPatch(
  data: NetWorthData,
  accountId: string,
  patch: ClassificationPatch,
): NetWorthData {
  return {
    ...data,
    assetLines: data.assetLines.map(line => (line.id === accountId ? { ...line, ...patch } : line)),
  };
}

export function useNetWorth(initialRange: NetWorthRange = '90d'): NetWorthState {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  // The window lives in the address, so a view can be linked to and survives
  // leaving the page and coming back.
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const custom: NetWorthCustomRange | null = from && to ? { from, to } : null;
  const range = (searchParams.get('range') as NetWorthRange | null) ?? initialRange;
  const view = searchParams.get('view') === 'breakdown' ? 'breakdown' : 'performance';
  const excluded = (searchParams.get('exclude') ?? '').split(',').filter(Boolean);
  const [denominate, setDenominate] = useState<'XAU' | null>(null);

  const writeParams = useCallback(
    (patch: Record<string, string | null>): void => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }
      const query = next.toString();
      router.replace(query ? `?${query}` : '?', { scroll: false });
    },
    [router, searchParams],
  );

  const setRange = useCallback(
    (next: NetWorthRange): void => writeParams({ range: next, from: null, to: null }),
    [writeParams],
  );
  const setCustom = useCallback(
    (next: NetWorthCustomRange | null): void =>
      writeParams(next ? { from: next.from, to: next.to } : { from: null, to: null }),
    [writeParams],
  );
  const setView = useCallback(
    (next: NetWorthView): void => writeParams({ view: next }),
    [writeParams],
  );

  const setExcluded = useCallback(
    (next: string[]): void => writeParams({ exclude: next.length > 0 ? next.join(',') : null }),
    [writeParams],
  );

  const window = custom ? { from: custom.from, to: custom.to } : { range };
  const params = {
    ...window,
    ...(excluded.length > 0 ? { exclude: excluded.join(',') } : {}),
    ...(denominate ? { denominate } : {}),
  };
  const queryKey = queryKeys.netWorth({
    workspaceId,
    range: [custom ? `${custom.from}:${custom.to}` : range, ...excluded].join('|'),
    denominate,
  });

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => apiQuery<NetWorthData>({ url: '/reports/net-worth', params, signal }),
    // Смена периода не должна гасить карточки: данные прошлого запроса живут
    // на экране до прихода новых, но только внутри того же воркспейса.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === workspaceId ? previous : undefined,
  });

  const classifyMutation = useMutation({
    mutationFn: (variables: { accountId: string; patch: ClassificationPatch }) =>
      apiClient.patch(
        `/reports/balance/accounts/${variables.accountId}/classification`,
        variables.patch,
      ),
    // Выбор в селекте применяется сразу, иначе он «откатывается» на время
    // запроса; проценты и сводки пересчитывает сервер — их ждём.
    onMutate: (variables: { accountId: string; patch: ClassificationPatch }) => {
      queryClient.setQueryData<NetWorthData>(queryKey, previous =>
        previous ? applyPatch(previous, variables.accountId, variables.patch) : previous,
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['net-worth', workspaceId] }),
  });

  const refetch = useCallback((): void => {
    void query.refetch();
  }, [query.refetch]);

  const classify = useCallback(
    (accountId: string, patch: ClassificationPatch): void => {
      classifyMutation.mutate({ accountId, patch });
    },
    [classifyMutation.mutate],
  );

  return {
    data: query.data,
    isPending: query.isPending,
    isFetching: query.isFetching || classifyMutation.isPending,
    error: query.isError || classifyMutation.isError,
    range,
    custom,
    view,
    excluded,
    setRange,
    setCustom,
    setView,
    setExcluded,
    denominate,
    setDenominate,
    refetch,
    classify,
  };
}

/**
 * A preset window held in the component, for a card on another page: the
 * page's own hook keeps its window in the address, which there would leak
 * `?range=` into a page that has its own parameters.
 */
export function useNetWorthPreset(initialRange: NetWorthRange): {
  data: NetWorthData | undefined;
  isFetching: boolean;
  range: NetWorthRange;
  setRange: (range: NetWorthRange) => void;
} {
  const workspaceId = useWorkspaceId();
  const [range, setRange] = useState<NetWorthRange>(initialRange);

  const query = useQuery({
    queryKey: queryKeys.netWorth({ workspaceId, range, denominate: null }),
    queryFn: ({ signal }) =>
      apiQuery<NetWorthData>({ url: '/reports/net-worth', params: { range }, signal }),
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === workspaceId ? previous : undefined,
  });

  return { data: query.data, isFetching: query.isFetching, range, setRange };
}
