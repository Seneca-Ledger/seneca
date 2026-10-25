'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { fetchGoalFlow, type GoalFlowResponse } from '@/app/lib/goals-api';
import { queryKeys } from '@/app/lib/query-keys';

export interface GoalFlowState {
  data: GoalFlowResponse | undefined;
  isPending: boolean;
  isFetching: boolean;
  error: string | null;
  refetch: () => void;
}

export function useGoalFlow(goalId: string, month: string): GoalFlowState {
  const workspaceId = useWorkspaceId();
  const t = useIntlayer('goalDetailPage');
  const query = useQuery({
    queryKey: queryKeys.goalFlow({ workspaceId, goalId, month }),
    queryFn: ({ signal }) => fetchGoalFlow(goalId, month, signal),
    // Previous data survives a month change but never a workspace change: a bare
    // keepPreviousData would show one workspace's spending under another's goal
    // for a frame (workspaceId is the third key segment).
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2] === workspaceId ? previous : undefined,
    enabled: Boolean(workspaceId),
  });

  const refetch = useCallback((): void => {
    void query.refetch();
  }, [query.refetch]);

  return {
    data: query.data,
    isPending: query.isPending,
    isFetching: query.isFetching,
    error: query.isError ? getApiErrorMessage(query.error, t.flowLoadFailed.value) : null,
    refetch,
  };
}
