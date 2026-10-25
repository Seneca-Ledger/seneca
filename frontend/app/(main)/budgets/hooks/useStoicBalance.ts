'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

export const STOIC_CLASSES = ['necessity', 'work', 'virtue', 'leisure'] as const;
export type StoicClass = (typeof STOIC_CLASSES)[number];
export type StoicTotals = Record<StoicClass | 'unclassified', number>;

export interface StoicMonth {
  month: string;
  monthsAgo: number;
  intended: StoicTotals;
  actual: StoicTotals;
  overBudgetCategoryIds: string[];
}

export interface StoicCategory {
  id: string;
  name: string;
  parentId: string | null;
  stoicClass: StoicClass | null;
  source: 'user' | 'suggested' | null;
  /** Whether this money goes to others (charity, donations, gifts). */
  helpsOthers: boolean;
  helpsOthersSource: 'user' | 'suggested';
  spent: number;
  budgeted: boolean;
  active: boolean;
}

/** What the user can decide about a category; absent fields are left alone. */
export interface CategoryJudgment {
  categoryId: string;
  stoicClass?: StoicClass | null;
  helpsOthers?: boolean;
}

export interface StoicBalance {
  months: StoicMonth[];
  categories: StoicCategory[];
}

/** Each class's share of the whole, in percent; all zeros when there is nothing. */
export function toShares(totals: StoicTotals): StoicTotals {
  const sum = Object.values(totals).reduce((acc, value) => acc + value, 0);
  const share = (value: number): number => (sum > 0 ? (value / sum) * 100 : 0);
  return {
    necessity: share(totals.necessity),
    work: share(totals.work),
    virtue: share(totals.virtue),
    leisure: share(totals.leisure),
    unclassified: share(totals.unclassified),
  };
}

/**
 * The Stoic split of the workspace's budgets and spending, and the mutation
 * that judges a category. Judging changes the advice too, so the insights
 * query is invalidated along with the balance.
 */
export function useStoicBalance(): {
  balance: StoicBalance | null;
  isPending: boolean;
  classify: (judgment: CategoryJudgment) => void;
  classifying: string | null;
} {
  const workspaceId = useWorkspaceId();
  const t = useIntlayer('budgetsPage');
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.stoicBalance(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/budgets/stoic-balance', signal, contract: 'StoicBalance' }),
    enabled: Boolean(workspaceId),
  });

  const classify = useMutation({
    mutationFn: async ({ categoryId, ...changes }: CategoryJudgment) => {
      await apiClient.put(
        `/categories/${categoryId}`,
        changes satisfies ContractInput<'UpdateCategoryBody'>,
      );
    },
    onError: error => toast.error(getApiErrorMessage(error, t.toastClassifyFailed.value)),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.stoicBalance(workspaceId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.insightsAll(workspaceId) }),
      ]),
  });

  return {
    balance: query.data ?? null,
    isPending: query.isPending,
    classify: classify.mutate,
    classifying: classify.isPending ? (classify.variables?.categoryId ?? null) : null,
  };
}
