'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { fetchGoalItems } from '@/app/lib/goals-api';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

/**
 * The goal one transaction counts toward, the goals it could count toward, the
 * linked goal's cost lines, and setters. `syncKey` changes when the transaction's amount, type or currency
 * was saved: a linked goal is then linked again, which recomputes the amount.
 */
export function useTransactionGoal(transactionId: string | null, syncKey?: string) {
  const t = useIntlayer('goalLinkField');
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const linkKey = queryKeys.transactionGoal({ workspaceId, transactionId: transactionId ?? '' });

  const link = useQuery({
    queryKey: linkKey,
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: `/transactions/${transactionId}/goal`,
        signal,
        contract: 'TransactionGoalLink',
      }),
    enabled: Boolean(workspaceId && transactionId),
  });
  const goals = useQuery({
    queryKey: queryKeys.goalsList(workspaceId),
    queryFn: ({ signal }) => apiQueryDecoded({ url: '/goals', signal, contract: 'GoalList' }),
    enabled: Boolean(workspaceId),
  });

  const linkedGoalId = link.data?.goal?.id ?? null;
  const items = useQuery({
    queryKey: queryKeys.goalItems({ workspaceId, goalId: linkedGoalId ?? '' }),
    queryFn: ({ signal }) => fetchGoalItems(linkedGoalId ?? '', signal),
    enabled: Boolean(workspaceId && linkedGoalId),
  });

  const mutation = useMutation({
    // `goalItemId` left out keeps the cost line already linked.
    mutationFn: async (body: ContractInput<'SetTransactionGoalBody'>) => {
      const url = `/transactions/${transactionId}/goal`;
      const response = await apiClient.put(url, body);
      return checkContract('TransactionGoalLink', response.data, url);
    },
    onSuccess: next => queryClient.setQueryData(linkKey, next),
    onError: () => toast.error(t.saveFailed.value),
    // Progress, pace and the goal page all read contributions.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['goals'] }),
  });

  const lastSync = useRef(syncKey);
  useEffect(() => {
    if (lastSync.current === syncKey) {
      return;
    }
    lastSync.current = syncKey;
    if (linkedGoalId) {
      mutation.mutate({ goalId: linkedGoalId });
    }
  }, [syncKey, linkedGoalId, mutation.mutate]);

  return {
    link: link.data ?? null,
    goals: goals.data ?? [],
    items: items.data?.items ?? [],
    loading: link.isPending || goals.isPending,
    saving: mutation.isPending,
    setGoal: (goalId: string | null) => mutation.mutate({ goalId }),
    setItem: (goalItemId: string | null) => mutation.mutate({ goalId: linkedGoalId, goalItemId }),
  };
}
