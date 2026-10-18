'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { usePermissions } from '@/app/hooks/usePermissions';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import type { ApiKeyItem, ApiKeyScope, CreatedApiKey } from '@/app/lib/contracts';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

export type { ApiKeyItem, ApiKeyScopes, CreatedApiKey } from '@/app/lib/contracts';

export function useApiKeys() {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const t = useIntlayer('mcpServerDrawer');
  const { hasPermission } = usePermissions();
  const [newKey, setNewKey] = useState<CreatedApiKey | null>(null);
  // Эндпоинт закрыт правом api_key.manage (есть только у admin), а хук висит в
  // топбаре на каждой странице — без права запрос давал бы 403 при каждой загрузке.
  const canManageKeys = hasPermission('api_key.manage');

  const query = useQuery({
    queryKey: queryKeys.apiKeys(workspaceId),
    // Ошибка не показывается отдельно — индикатор статуса и так станет красным.
    queryFn: ({ signal }) => apiQueryDecoded({ url: '/api-keys', signal, contract: 'ApiKeyList' }),
    enabled: canManageKeys,
  });

  const keys = query.data ?? [];

  const createMutation = useMutation({
    mutationFn: (input: ContractInput<'CreateApiKeyBody'>) =>
      apiClient
        .post('/api-keys', input)
        .then(response => checkContract('CreatedApiKey', response.data, '/api-keys')),
    onSuccess: created => {
      setNewKey(created);
      toast.success(t.toasts.keyCreated.value);
    },
    onError: () => toast.error(t.toasts.createFailed.value),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys(workspaceId) }),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api-keys/${id}`);
    },
    onSuccess: (_response, id) => {
      queryClient.setQueryData<ApiKeyItem[]>(queryKeys.apiKeys(workspaceId), previous =>
        (previous ?? []).filter(k => k.id !== id),
      );
      toast.success(t.toasts.keyRevoked.value);
    },
    onError: () => toast.error(t.toasts.revokeFailed.value),
  });

  const scopesQuery = useQuery({
    queryKey: [...queryKeys.apiKeys(workspaceId), 'scopes'],
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/api-keys/scopes', signal, contract: 'ApiKeyScopes' }),
    enabled: canManageKeys,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const create = useCallback(
    async (name: string, scopes: ApiKeyScope[]) => {
      createMutation.mutate({ name, scopes });
    },
    [createMutation.mutate],
  );

  const revoke = useCallback(
    async (id: string) => {
      revokeMutation.mutate(id);
    },
    [revokeMutation.mutate],
  );

  const reload = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys(workspaceId) });
  }, [queryClient, workspaceId]);

  const clearNewKey = useCallback(() => setNewKey(null), []);

  const isActive = keys.length > 0;

  return {
    keys,
    // Без права запрос не стартует, и query навсегда остался бы в pending.
    loading: canManageKeys && query.isPending,
    newKey,
    isActive,
    scopes: scopesQuery.data ?? null,
    create,
    revoke,
    clearNewKey,
    reload,
  };
}
