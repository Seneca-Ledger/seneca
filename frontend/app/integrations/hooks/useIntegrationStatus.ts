'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import apiClient from '@/app/lib/api';
import { apiQuery } from '@/app/lib/query-fn';
import { queryKeys } from '@/app/lib/query-keys';
import type { IntegrationStatus, IntegrationStatusMessages } from '../types';

export type UseIntegrationStatusConfig = {
  /** The API route segment, e.g. 'gmail', 'dropbox', 'google-drive' */
  apiPath: string;
  /** User object — status is loaded only when truthy (checked for truthiness only) */
  user: object | null | undefined;
  messages: IntegrationStatusMessages;
};

export type UseIntegrationStatusResult = {
  status: IntegrationStatus | null;
  loading: boolean;
  saving: boolean;
  syncing: boolean;
  loadStatus: () => Promise<void>;
  handleConnect: () => Promise<void>;
  handleDisconnect: () => Promise<void>;
  handleSync: () => Promise<void>;
};

// eslint-disable-next-line max-lines-per-function
export function useIntegrationStatus({
  apiPath,
  user,
  messages,
}: UseIntegrationStatusConfig): UseIntegrationStatusResult {
  const searchParams = useSearchParams();
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();

  const base = `/integrations/${apiPath}`;
  const queryKey = queryKeys.integrationStatus({ workspaceId, apiPath });

  const statusQuery = useQuery({
    queryKey,
    // Unchecked on purpose: Gmail, Google Drive and Dropbox are going away, so they get no contract.
    queryFn: async ({ signal }) =>
      (await apiQuery({ url: `${base}/status`, signal })) as IntegrationStatus,
    enabled: Boolean(user),
  });

  const loadFailed = statusQuery.isError;
  const loadFailedMessage = messages.errors.loadStatus;
  useEffect(() => {
    if (loadFailed) {
      toast.error(loadFailedMessage, { id: `integration-status-${apiPath}` });
    }
  }, [loadFailed, loadFailedMessage, apiPath]);

  const loadStatus = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey });
  }, [queryClient, workspaceId, apiPath]);

  useEffect(() => {
    // eslint-disable-next-line complexity
    const handleCallback = (): void => {
      const successParam = messages.successCallbackParam ?? 'connected';
      const statusParam = searchParams.get('status');
      if (statusParam === successParam || statusParam === 'success') {
        toast.success(messages.toasts.connected);
      }
      if (statusParam === 'error') {
        if (messages.onCallbackError) {
          const reason = searchParams.get('reason') ?? undefined;
          messages.onCallbackError(reason);
        } else {
          toast.error(messages.errors.connectFailed);
        }
      }
    };
    handleCallback();
  }, [searchParams, messages]);

  const handleConnect = useCallback(async () => {
    return await (async () => {
      toast.success(messages.toasts.connecting);
      const response = await apiClient.get(`${base}/connect`);
      // Unchecked on purpose: Gmail, Google Drive and Dropbox are going away, so they get no contract.
      const url = (response.data as { url?: string } | null)?.url;
      if (!url) {
        toast.error(messages.errors.connectFailed);
        return;
      }
      window.location.href = url;
    })().catch(async () => {
      toast.error(messages.errors.connectFailed);
    });
  }, [base, messages]);

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post(`${base}/disconnect`);
    },
    onSuccess: () => toast.success(messages.toasts.disconnected),
    onError: () => toast.error(messages.errors.disconnectFailed),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post(`${base}/sync`);
    },
    onSuccess: () => toast.success(messages.toasts.syncStarted),
    onError: () => toast.error(messages.errors.syncFailed),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const handleDisconnect = useCallback(async () => {
    disconnectMutation.mutate();
  }, [disconnectMutation.mutate]);

  const handleSync = useCallback(async () => {
    syncMutation.mutate();
  }, [syncMutation.mutate]);

  return {
    status: statusQuery.data ?? null,
    // isLoading, а не isPending: без пользователя запрос выключен, и isPending
    // остался бы true навсегда.
    loading: statusQuery.isLoading,
    saving: disconnectMutation.isPending,
    syncing: syncMutation.isPending,
    loadStatus,
    handleConnect,
    handleDisconnect,
    handleSync,
  };
}
