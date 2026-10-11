'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { fetchGoalItems, type GoalItemPayload, type GoalItemsResponse } from '@/app/lib/goals-api';
import { unwrapEnvelope } from '@/app/lib/query-fn';
import { checkContract } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

export interface GoalItemsState {
  data: GoalItemsResponse | undefined;
  isPending: boolean;
  isSaving: boolean;
  error: string | null;
  createItem: (payload: GoalItemPayload) => Promise<void>;
  updateItem: (itemId: string, payload: Partial<GoalItemPayload>) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
}

type Write =
  | { kind: 'create'; payload: GoalItemPayload }
  | { kind: 'update'; itemId: string; payload: Partial<GoalItemPayload> }
  | { kind: 'remove'; itemId: string };

export function useGoalItems(goalId: string): GoalItemsState {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.goalItems({ workspaceId, goalId });

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchGoalItems(goalId, signal),
  });

  // Every write returns the whole list back, so the response is written
  // straight into the cache instead of being refetched.
  const mutation = useMutation({
    mutationFn: async (write: Write): Promise<GoalItemsResponse> => {
      const base = `/goals/${goalId}/items`;
      const response =
        write.kind === 'create'
          ? await apiClient.post(base, write.payload)
          : write.kind === 'update'
            ? await apiClient.patch(`${base}/${write.itemId}`, write.payload)
            : await apiClient.delete(`${base}/${write.itemId}`);
      return checkContract('GoalItemsResponse', unwrapEnvelope(response.data), base);
    },
    onSuccess: (data: GoalItemsResponse) => {
      queryClient.setQueryData(queryKey, data);
      // The plan reads the estimate and the flow reads the goal, so both are
      // stale the moment a line changes.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.goalPlan({ workspaceId, goalId }),
      });
    },
  });

  const createItem = useCallback(
    async (payload: GoalItemPayload) => {
      await mutation.mutateAsync({ kind: 'create', payload });
    },
    [mutation.mutateAsync],
  );

  const updateItem = useCallback(
    async (itemId: string, payload: Partial<GoalItemPayload>) => {
      await mutation.mutateAsync({ kind: 'update', itemId, payload });
    },
    [mutation.mutateAsync],
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      await mutation.mutateAsync({ kind: 'remove', itemId });
    },
    [mutation.mutateAsync],
  );

  return {
    data: query.data,
    isPending: query.isPending,
    isSaving: mutation.isPending,
    error: query.isError ? getApiErrorMessage(query.error, 'Failed to load goal items') : null,
    createItem,
    updateItem,
    removeItem,
  };
}
