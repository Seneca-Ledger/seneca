'use client';

import { useQuery } from '@tanstack/react-query';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import type { MonthGoal } from '@/app/lib/contracts';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

/** A goal the server picked out for one month, with what it received in it. */
export type { MonthGoal } from '@/app/lib/contracts';

interface UseMonthGoalsState {
  goals: MonthGoal[];
  isPending: boolean;
  error: boolean;
}

/**
 * The goals that were actually moved forward in `month` (`YYYY-MM`) — read
 * only, for places that show progress next to other monthly figures.
 */
export function useMonthGoals(month: string): UseMonthGoalsState {
  const workspaceId = useWorkspaceId();

  const query = useQuery({
    queryKey: queryKeys.goalsMonth({ workspaceId, month }),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: `/goals?month=${month}`, signal, contract: 'MonthGoalList' }),
  });

  return {
    goals: query.data ?? [],
    isPending: query.isPending,
    error: query.isError,
  };
}
