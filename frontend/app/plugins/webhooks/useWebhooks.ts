'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

/** The events a webhook subscription can listen to. */
export type WebhookEventName = ContractInput<'CreateWebhookSubscriptionBody'>['events'][number];

export interface WebhookEndpoint {
  id: string;
  name: string;
  tokenPreview: string;
  isActive: boolean;
  defaultWalletId: string | null;
  defaultBranchId: string | null;
  createdAt: string;
}

export interface WebhookEndpointFull extends WebhookEndpoint {
  token: string; // only on creation
}

export interface WebhookSubscription {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
}

export function useWebhookEndpoints() {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const t = useIntlayer('webhooksDrawer');
  const [newToken, setNewToken] = useState<string | null>(null);

  const query = useQuery({
    queryKey: queryKeys.webhookEndpoints(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/webhook-endpoints', signal, contract: 'WebhookEndpointList' }),
  });

  const invalidate = useCallback((): Promise<void> => {
    return queryClient.invalidateQueries({ queryKey: queryKeys.webhookEndpoints(workspaceId) });
  }, [queryClient, workspaceId]);

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiClient.post('/webhook-endpoints', {
        name,
      } satisfies ContractInput<'CreateWebhookEndpointBody'>);
      return checkContract('CreatedWebhookEndpoint', response.data, '/webhook-endpoints');
    },
    onSuccess: endpoint => {
      setNewToken(endpoint.token);
      toast.success(t.toasts.endpointCreated.value);
    },
    onError: () => toast.error(t.toasts.endpointCreateFailed.value),
    onSettled: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/webhook-endpoints/${id}`);
    },
    onSuccess: () => toast.success(t.toasts.endpointDeleted.value),
    onError: () => toast.error(t.toasts.endpointDeleteFailed.value),
    onSettled: invalidate,
  });

  const toggleMutation = useMutation({
    mutationFn: async (variables: { id: string; isActive: boolean }) => {
      await apiClient.patch(`/webhook-endpoints/${variables.id}`, {
        isActive: !variables.isActive,
      } satisfies ContractInput<'UpdateWebhookEndpointBody'>);
    },
    onError: () => toast.error(t.toasts.endpointUpdateFailed.value),
    onSettled: invalidate,
  });

  const load = useCallback(async () => {
    await invalidate();
  }, [invalidate]);

  const create = useCallback(
    async (name: string) => {
      createMutation.mutate(name);
    },
    [createMutation.mutate],
  );

  const remove = useCallback(
    async (id: string) => {
      removeMutation.mutate(id);
    },
    [removeMutation.mutate],
  );

  const toggle = useCallback(
    async (id: string, isActive: boolean) => {
      toggleMutation.mutate({ id, isActive });
    },
    [toggleMutation.mutate],
  );

  return {
    endpoints: query.data ?? [],
    loading: query.isPending,
    newToken,
    setNewToken,
    load,
    create,
    remove,
    toggle,
  };
}

export function useWebhookSubscriptions() {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const t = useIntlayer('webhooksDrawer');

  const query = useQuery({
    queryKey: queryKeys.webhookSubscriptions(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: '/webhook-subscriptions',
        signal,
        contract: 'WebhookSubscriptionList',
      }),
  });

  const invalidate = useCallback((): Promise<void> => {
    return queryClient.invalidateQueries({
      queryKey: queryKeys.webhookSubscriptions(workspaceId),
    });
  }, [queryClient, workspaceId]);

  const createMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      url: string;
      secret: string;
      events: WebhookEventName[];
    }) => {
      await apiClient.post(
        '/webhook-subscriptions',
        data satisfies ContractInput<'CreateWebhookSubscriptionBody'>,
      );
    },
    onSuccess: () => toast.success(t.toasts.subscriptionCreated.value),
    onError: () => toast.error(t.toasts.subscriptionCreateFailed.value),
    onSettled: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/webhook-subscriptions/${id}`);
    },
    onSuccess: () => toast.success(t.toasts.subscriptionDeleted.value),
    onError: () => toast.error(t.toasts.subscriptionDeleteFailed.value),
    onSettled: invalidate,
  });

  const load = useCallback(async () => {
    await invalidate();
  }, [invalidate]);

  const create = useCallback(
    async (data: { name: string; url: string; secret: string; events: WebhookEventName[] }) => {
      createMutation.mutate(data);
    },
    [createMutation.mutate],
  );

  const remove = useCallback(
    async (id: string) => {
      removeMutation.mutate(id);
    },
    [removeMutation.mutate],
  );

  const testPing = useCallback(
    async (id: string) => {
      await (async () => {
        await apiClient.post(`/webhook-subscriptions/${id}/test`);
        toast.success(t.toasts.testQueued.value);
      })().catch(async () => {
        toast.error(t.toasts.testFailed.value);
      });
    },
    [t.toasts.testQueued, t.toasts.testFailed],
  );

  return {
    subscriptions: query.data ?? [],
    loading: query.isPending,
    load,
    create,
    remove,
    testPing,
  };
}
