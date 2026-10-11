'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import apiClient from '@/app/lib/api';
import type {
  CapitalRole,
  NetWorthResponse as NetWorthData,
  NetWorthRange,
  RiskLevel,
} from '@/app/lib/contracts';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

export type {
  CapitalRole,
  NetWorthAssetLine,
  NetWorthBreakdownItem,
  NetWorthClassificationItem,
  NetWorthDenominated,
  NetWorthPoint,
  NetWorthRange,
  NetWorthResponse as NetWorthData,
  RiskLevel,
} from '@/app/lib/contracts';

export const NET_WORTH_RANGES: NetWorthRange[] = ['30d', '90d', '180d', '1y', '3y', '5y', 'all'];

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
  setRange: (range: NetWorthRange) => void;
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
  const [range, setRange] = useState<NetWorthRange>(initialRange);
  const [denominate, setDenominate] = useState<'XAU' | null>(null);

  const queryKey = queryKeys.netWorth({ workspaceId, range, denominate });

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: '/reports/net-worth',
        params: denominate ? { range, denominate } : { range },
        signal,
        contract: 'NetWorthResponse',
      }),
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
    setRange,
    denominate,
    setDenominate,
    refetch,
    classify,
  };
}
