'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import apiClient from '@/app/lib/api';
import type {
  CapitalRole,
  NetWorthResponse as NetWorthData,
  NetWorthRange,
  RiskLevel,
} from '@/app/lib/contracts';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

export type {
  CapitalRole,
  NetWorthAssetLine,
  NetWorthAttribution,
  NetWorthAttributionRow,
  NetWorthBreakdownItem,
  NetWorthChangeKind,
  NetWorthClassificationItem,
  NetWorthDenominated,
  NetWorthPoint,
  NetWorthRange,
  NetWorthResponse as NetWorthData,
  NetWorthSavings,
  RiskLevel,
} from '@/app/lib/contracts';

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

export const CAPITAL_ROLES: CapitalRole[] = ['income', 'neutral', 'drain'];
export const RISK_LEVELS: RiskLevel[] = ['low', 'medium', 'high'];

/** The share of assets above which the 80/20 rule is considered broken. */
export const RISKY_ALLOCATION_THRESHOLD = 20;

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
  } satisfies ContractInput<'NetWorthQuery'>;
  const queryKey = queryKeys.netWorth({
    workspaceId,
    range: [custom ? `${custom.from}:${custom.to}` : range, ...excluded].join('|'),
    denominate,
  });

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/reports/net-worth', params, signal, contract: 'NetWorthResponse' }),
    // Смена периода не должна гасить карточки: данные прошлого запроса живут
    // на экране до прихода новых, но только внутри того же воркспейса.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === workspaceId ? previous : undefined,
    enabled: Boolean(workspaceId),
  });

  const classifyMutation = useMutation({
    mutationFn: async (variables: { accountId: string; patch: ClassificationPatch }) => {
      await apiClient.patch(
        `/reports/balance/accounts/${variables.accountId}/classification`,
        variables.patch satisfies ContractInput<'UpdateAccountClassificationBody'>,
      );
    },
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
 * `?range=` into a page that has its own parameters. `to` (`YYYY-MM-DD`) ends
 * the window on that day instead of today, for a past version of the books.
 */
export function useNetWorthPreset(
  initialRange: NetWorthRange,
  to: string | null = null,
): {
  data: NetWorthData | undefined;
  isFetching: boolean;
  range: NetWorthRange;
  setRange: (range: NetWorthRange) => void;
} {
  const workspaceId = useWorkspaceId();
  const [range, setRange] = useState<NetWorthRange>(initialRange);

  const query = useQuery({
    queryKey: queryKeys.netWorth({ workspaceId, range, denominate: null, to }),
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: '/reports/net-worth',
        params: { range, ...(to ? { to } : {}) } satisfies ContractInput<'NetWorthQuery'>,
        signal,
        contract: 'NetWorthResponse',
      }),
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === workspaceId ? previous : undefined,
    enabled: Boolean(workspaceId),
  });

  return { data: query.data, isFetching: query.isFetching, range, setRange };
}
