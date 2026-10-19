'use client';

import { useQuery } from '@tanstack/react-query';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { fetchGoalPlan, type GoalPlanResponse } from '@/app/lib/goals-api';
import { queryKeys } from '@/app/lib/query-keys';

export interface GoalPlanState {
  data: GoalPlanResponse | undefined;
  isPending: boolean;
  error: string | null;
}

/**
 * The savings plan is derived entirely on the server from contributions,
 * budgets and income, so there is nothing to keep in sync here — the item
 * mutations invalidate the `goals` prefix and this refetches with them.
 */
export function useGoalPlan(goalId: string): GoalPlanState {
  const workspaceId = useWorkspaceId();
  const query = useQuery({
    queryKey: queryKeys.goalPlan({ workspaceId, goalId }),
    queryFn: ({ signal }) => fetchGoalPlan(goalId, signal),
    enabled: Boolean(workspaceId),
  });

  return {
    data: query.data,
    isPending: query.isPending,
    error: query.isError ? getApiErrorMessage(query.error, 'Failed to load goal plan') : null,
  };
}
