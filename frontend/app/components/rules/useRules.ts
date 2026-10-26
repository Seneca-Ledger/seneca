'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import apiClient from '@/app/lib/api';
import { invalidateFinancialData } from '@/app/lib/invalidate-document-lists';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { apiQueryDecoded, checkContract } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import type { RuleCondition, RuleDraftBody } from './types';

/** How long the preview waits for typing to stop before asking the server. */
const PREVIEW_DEBOUNCE_MS = 400;

/** Every rule of the workspace, highest priority first. */
export function useRulesList() {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.categorizationRules(workspaceId),
    // Not apiQueryDecoded: it would unwrap `data` and drop the total.
    queryFn: ({ signal }) =>
      apiClient
        .get('/categorization-rules', { signal })
        .then(response =>
          checkContract('CategorizationRuleList', response.data, '/categorization-rules'),
        ),
    enabled: Boolean(workspaceId),
  });
}

/** The categories and accounts a rule can name. */
export function useRuleTargets() {
  const workspaceId = useWorkspaceId();
  const categories = useQuery({
    queryKey: queryKeys.categories(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/categories', signal, contract: 'CategoryList' }),
    enabled: Boolean(workspaceId),
  });
  const wallets = useQuery({
    queryKey: queryKeys.wallets(workspaceId),
    queryFn: ({ signal }) => apiQueryDecoded({ url: '/wallets', signal, contract: 'WalletList' }),
    enabled: Boolean(workspaceId),
  });
  return { categories: categories.data ?? [], wallets: wallets.data ?? [] };
}

function useInvalidateRules() {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.categorizationRules(workspaceId) }),
    [queryClient, workspaceId],
  );
}

export function useSaveRule() {
  const invalidate = useInvalidateRules();
  return useMutation({
    mutationFn: ({ id, body }: { id: string | null; body: RuleDraftBody }) =>
      (id
        ? apiClient.put(
            `/categorization-rules/${id}`,
            body satisfies ContractInput<'UpdateCategorizationRuleBody'>,
          )
        : apiClient.post(
            '/categorization-rules',
            body satisfies ContractInput<'CreateCategorizationRuleBody'>,
          )
      ).then(response =>
        checkContract('CategorizationRule', response.data, '/categorization-rules'),
      ),
    onSuccess: invalidate,
  });
}

export function useToggleRule() {
  const invalidate = useInvalidateRules();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await apiClient.put(`/categorization-rules/${id}`, {
        isActive,
      } satisfies ContractInput<'UpdateCategorizationRuleBody'>);
    },
    onSuccess: invalidate,
  });
}

export function useDeleteRule() {
  const invalidate = useInvalidateRules();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/categorization-rules/${id}`);
    },
    onSuccess: invalidate,
  });
}

/** Files the rule's existing matches; every figure built from them moves. */
export function useApplyRule() {
  return useMutation({
    mutationFn: (id: string) =>
      apiClient
        .post(`/categorization-rules/${id}/apply`)
        .then(response =>
          checkContract(
            'CategorizationRuleApplyResult',
            response.data,
            '/categorization-rules/:id/apply',
          ),
        ),
    onSuccess: invalidateFinancialData,
  });
}

/** Conditions the server would accept: a value in every row. */
export function completeConditions(conditions: RuleCondition[]): RuleCondition[] {
  return conditions.filter(condition => String(condition.value).trim() !== '');
}

/** What the conditions match among the workspace's rows, a moment after typing stops. */
export function useRulePreview(conditions: RuleCondition[], enabled: boolean) {
  const workspaceId = useWorkspaceId();
  const complete = completeConditions(conditions);
  const serialized = JSON.stringify(complete);
  const [settled, setSettled] = useState(serialized);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(serialized), PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [serialized]);
  const settledConditions = JSON.parse(settled) as RuleCondition[];

  return useQuery({
    queryKey: queryKeys.categorizationRulePreview(workspaceId, settledConditions),
    queryFn: ({ signal }) =>
      apiClient
        .post(
          '/categorization-rules/test',
          { conditions: settledConditions } satisfies ContractInput<'TestCategorizationRuleBody'>,
          { signal },
        )
        .then(response =>
          checkContract(
            'CategorizationRuleTestResult',
            response.data,
            '/categorization-rules/test',
          ),
        ),
    enabled: enabled && Boolean(workspaceId) && settledConditions.length > 0,
    placeholderData: previous => previous,
  });
}
