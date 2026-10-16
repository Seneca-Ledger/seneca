'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { SystemUpdateStatus } from '@/app/lib/contracts';
import { apiQueryDecoded, checkContract } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

const POLL_MS = 3000;

/** The new backend answers with the version the run installed. */
export function isUpdateInstalled(status: SystemUpdateStatus | undefined): boolean {
  return (
    status?.run.state === 'succeeded' &&
    !!status.run.tag &&
    status.currentVersion === status.run.tag
  );
}

/**
 * Version check and the in-app `make upgrade` for instance admins. While a run
 * is going the status is polled; the backend restarts halfway, so failed polls
 * are expected and simply retried on the next tick. Once the new backend
 * reports the installed version, the page reloads onto the new frontend.
 */
export function useSystemUpdate(
  enabled: boolean,
  requestFailedText: string,
): {
  status: SystemUpdateStatus | undefined;
  installing: boolean;
  installed: boolean;
  startUpdate: () => void;
  starting: boolean;
} {
  const queryClient = useQueryClient();
  const [tracking, setTracking] = useState(false);

  const query = useQuery({
    queryKey: queryKeys.systemUpdate(),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/system/update', signal, contract: 'SystemUpdateStatus' }),
    enabled,
    retry: tracking ? false : 1,
    refetchInterval: current =>
      tracking || current.state.data?.run.state === 'running' ? POLL_MS : false,
  });

  const status = query.data;
  const runState = status?.run.state;
  const installed = tracking && isUpdateInstalled(status);

  // A run started from another tab is followed here too.
  useEffect(() => {
    if (runState === 'running') {
      setTracking(true);
    }
    if (runState === 'failed') {
      setTracking(false);
    }
  }, [runState]);

  useEffect(() => {
    if (installed) {
      window.location.reload();
    }
  }, [installed]);

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/system/update');
      return checkContract('SystemUpdateStatus', response.data, '/system/update');
    },
    onSuccess: next => {
      queryClient.setQueryData(queryKeys.systemUpdate(), next);
      setTracking(true);
    },
    onError: error => toast.error(getApiErrorMessage(error, requestFailedText)),
  });

  return {
    status,
    installing: tracking && !installed && runState !== 'failed',
    installed,
    startUpdate: () => mutation.mutate(),
    starting: mutation.isPending,
  };
}
