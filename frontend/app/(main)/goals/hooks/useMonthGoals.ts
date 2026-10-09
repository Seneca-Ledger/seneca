'use client';

import { useQuery } from '@tanstack/react-query';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { apiQuery } from '@/app/lib/query-fn';
import { queryKeys } from '@/app/lib/query-keys';
import type { Goal } from './useGoals';

/** A goal the server picked out for one month, with what it received in it. */
export interface MonthGoal extends Goal {
  contributedInMonth: number;
}

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
    queryFn: ({ signal }) => apiQuery<MonthGoal[]>({ url: `/goals?month=${month}`, signal }),
  });

  return {
    goals: query.data ?? [],
    isPending: query.isPending,
    error: query.isError,
  };
}
