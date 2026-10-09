'use client';

import { useQuery } from '@tanstack/react-query';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { apiQuery } from '@/app/lib/query-fn';
import { queryKeys } from '@/app/lib/query-keys';
import type { ReturnsRange } from '../helpers/roi-url-state';

export type ReturnsFlagCode =
  | 'stale_price'
  | 'manual_price'
  | 'missing_fx'
  | 'metal_cost_missing'
  | 'opening_value_unknown'
  | 'no_contributions'
  | 'crypto_not_in_return'
  | 'crypto_basis_incomplete'
  | 'crypto_unpriced'
  | 'xirr_no_solution';

export interface ReturnsFlag {
  code: ReturnsFlagCode;
  sourceId?: string;
  detail?: string;
}

export interface ReturnsSource {
  kind: 'account' | 'metals' | 'crypto';
  id: string;
  name: string;
  /** Period rows cover the window; crypto's covers its whole history. */
  scope: 'period' | 'all_time';
  startValue: number;
  endValue: number;
  contributions: number;
  withdrawals: number;
  income: number;
  gain: number;
  returnPercent: number | null;
  includedInReturn: boolean;
  flags: ReturnsFlagCode[];
}

export interface ReturnsPoint {
  date: string;
  value: number;
  netContributed: number;
}

export interface ReturnsData {
  range: ReturnsRange;
  from: string;
  to: string;
  days: number;
  currency: string;
  summary: {
    startValue: number;
    endValue: number;
    contributions: number;
    withdrawals: number;
    income: number;
    gain: number;
    netInvested: number;
    returnPercent: number | null;
    method: 'modified_dietz';
    annualizedPercent: number | null;
    annualizedMethod: 'xirr' | null;
  };
  series: ReturnsPoint[];
  sources: ReturnsSource[];
  flags: ReturnsFlag[];
}

export function useReturns(range: ReturnsRange, enabled = true) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.investmentReturns({ workspaceId, range }),
    queryFn: ({ signal }) =>
      apiQuery<ReturnsData>({ url: '/investments/returns', params: { range }, signal }),
    enabled: enabled && Boolean(workspaceId),
    // A range switch keeps the previous figures on screen, within the same workspace only.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === workspaceId ? previous : undefined,
  });
}
