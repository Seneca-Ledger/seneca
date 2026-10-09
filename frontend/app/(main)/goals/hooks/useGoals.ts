'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import apiClient from '@/app/lib/api';
import { apiQuery } from '@/app/lib/query-fn';
import { queryKeys } from '@/app/lib/query-keys';

/** How the goal's picture should be drawn. Mirrors the server's GoalCover. */
export type GoalCover =
  | { kind: 'preset'; preset: string }
  | { kind: 'photo'; url: string; attribution: string | null; sourceUrl: string | null };

/**
 * What the picker hands back, which is not the same shape the server returns:
 * a photo is chosen by its Openverse id, and only afterwards becomes a stored
 * file the goal serves by its own id.
 */
export type GoalCoverSelection =
  | { kind: 'preset'; preset: string }
  | { kind: 'photo'; photoId: string; attribution: string };

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currency: string;
  targetDate: string | null;
  currentAmount: number;
  remaining: number;
  percent: number;
  isReached: boolean;
  cover: GoalCover | null;
}

export interface GoalFormData {
  name: string;
  targetAmount: number;
  targetDate: string;
  /**
   * `undefined` means "leave the cover alone", `null` means "remove it". The
   * distinction matters on edit, where not opening the picker must not wipe
   * the picture the goal already has.
   */
  cover?: GoalCoverSelection | null;
}

export const EMPTY_GOAL_FORM: GoalFormData = {
  name: '',
  targetAmount: 0,
  targetDate: '',
};

interface UseGoalsState {
  goals: Goal[];
  isPending: boolean;
  isFetching: boolean;
  error: string | null;
  saving: boolean;
  reload: () => void;
  createGoal: (form: GoalFormData) => Promise<boolean>;
  updateGoal: (id: string, form: GoalFormData) => Promise<boolean>;
  deleteGoal: (id: string) => Promise<void>;
  addContribution: (id: string, amount: number, note: string) => Promise<boolean>;
}

/**
 * The cover is its own request because it is its own resource: picking a photo
 * downloads bytes, which has no business happening inside the write that renames
 * a goal. On create the goal has to exist first, so the id only becomes
 * available after the POST.
 */
async function applyCover(
  goalId: string,
  cover: GoalCoverSelection | null | undefined,
): Promise<void> {
  if (cover === undefined) {
    return;
  }
  if (cover === null) {
    await apiClient.delete(`/goals/${goalId}/cover`);
    return;
  }
  await apiClient.put(
    `/goals/${goalId}/cover`,
    cover.kind === 'preset' ? { preset: cover.preset } : { photoId: cover.photoId },
  );
}

export function useGoals(): UseGoalsState {
  // Workspace-scoped: the request itself does not mention the workspace (the
  // server scopes by session), so the key carries it explicitly.
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.goalsList(workspaceId),
    queryFn: ({ signal }) => apiQuery<Goal[]>({ url: '/goals', signal }),
  });

  const mutation = useMutation({
    mutationFn: (request: () => Promise<unknown>) => request(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.goalsList(workspaceId) }),
  });

  const submit = useCallback(
    async (request: () => Promise<unknown>) => {
      return await mutation
        .mutateAsync(request)
        .then(() => true)
        .catch(() => false);
    },
    [mutation.mutateAsync],
  );

  const toPayload = (form: GoalFormData) => ({
    name: form.name.trim(),
    targetAmount: form.targetAmount,
    // An empty date field means "no deadline", not an empty string.
    targetDate: form.targetDate === '' ? undefined : form.targetDate,
  });

  const createGoal = useCallback(
    (form: GoalFormData) =>
      submit(async () => {
        const response = await apiClient.post<Goal>('/goals', toPayload(form));
        await applyCover(response.data.id, form.cover);
      }),
    [submit],
  );

  const updateGoal = useCallback(
    (id: string, form: GoalFormData) =>
      submit(async () => {
        await apiClient.put(`/goals/${id}`, toPayload(form));
        await applyCover(id, form.cover);
      }),
    [submit],
  );

  const deleteGoal = useCallback(
    async (id: string) => {
      await submit(() => apiClient.delete(`/goals/${id}`));
    },
    [submit],
  );

  const addContribution = useCallback(
    (id: string, amount: number, note: string) =>
      submit(() =>
        apiClient.post(`/goals/${id}/contributions`, {
          amount,
          note: note.trim() === '' ? undefined : note.trim(),
        }),
      ),
    [submit],
  );

  const reload = useCallback((): void => {
    void query.refetch();
  }, [query.refetch]);

  return {
    goals: query.data ?? [],
    isPending: query.isPending,
    isFetching: query.isFetching,
    error: query.isError || mutation.isError ? 'failed' : null,
    saving: mutation.isPending,
    reload,
    createGoal,
    updateGoal,
    deleteGoal,
    addContribution,
  };
}
