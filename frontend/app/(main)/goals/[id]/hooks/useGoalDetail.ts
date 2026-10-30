'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

/**
 * Every movement of one goal (`GET /goals/:id`), and removing one typed in by
 * hand. A linked movement is undone from its receipt or bank row instead.
 */
export function useGoalDetail(goalId: string) {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const t = useIntlayer('goalMovementsCard');

  const query = useQuery({
    queryKey: queryKeys.goalDetail({ workspaceId, goalId }),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: `/goals/${goalId}`, signal, contract: 'GoalDetail' }),
    enabled: Boolean(workspaceId && goalId),
  });

  const removal = useMutation({
    mutationFn: async (contributionId: string) => {
      await apiClient.delete(`/goals/${goalId}/contributions/${contributionId}`);
    },
    onError: () => toast.error(t.removeFailed.value),
    // Progress, the plan and the dashboard all read contributions.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['goals'] }),
  });

  return {
    data: query.data,
    removing: removal.isPending,
    removeContribution: (contributionId: string) => removal.mutate(contributionId),
  };
}
