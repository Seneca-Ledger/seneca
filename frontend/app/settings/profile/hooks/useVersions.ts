'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import apiClient from '@/app/lib/api';
import type { OpenedWorkspaceVersion, WorkspaceVersion } from '@/app/lib/contracts';
import { apiQueryDecoded, checkContract } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

const POLL_MS = 3000;

/** The workspace's dated versions; polled while one is still being taken. */
export function useVersions(enabled: boolean) {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const key = queryKeys.workspaceVersions(workspaceId);

  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/versions', signal, contract: 'WorkspaceVersionList' }),
    enabled: enabled && Boolean(workspaceId),
    retry: false,
    refetchInterval: current =>
      current.state.data?.some(version => version.status === 'running') ? POLL_MS : false,
  });

  const take = useMutation({
    mutationFn: async (): Promise<WorkspaceVersion> => {
      const response = await apiClient.post('/versions');
      return checkContract('WorkspaceVersion', response.data, '/versions');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const copy = useMutation({
    mutationFn: async (input: { id: string; name: string }): Promise<OpenedWorkspaceVersion> => {
      const url = `/versions/${input.id}/copy`;
      const response = await apiClient.post(url, { name: input.name });
      return checkContract('OpenedWorkspaceVersion', response.data, url);
    },
  });

  return { query, take, copy };
}
