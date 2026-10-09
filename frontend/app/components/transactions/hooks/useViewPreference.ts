'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';

import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import api from '@/app/lib/api';
import { apiQuery } from '@/app/lib/query-fn';

/** The pages that remember themselves; the server keeps the same closed list. */
export type ViewScope = 'transactions' | 'review' | 'reports' | 'dashboard';

/** Long: this is read once on mount and written by the page itself. */
const PREFERENCE_STALE_TIME = 30 * 60 * 1000;

interface ViewPreferenceResponse<T> {
  state: T | null;
}

export interface UseViewPreferenceResult<T> {
  /** `undefined` until the saved state has loaded; `null` when nothing was saved. */
  state: T | null | undefined;
  save: (next: T) => void;
}

/**
 * How this person left this page last time.
 *
 * Writes are fire-and-forget and the local cache is updated first: nobody
 * should wait on a round trip to change a filter, and a failed save is worth no
 * more than losing the preference.
 */
export function useViewPreference<T extends Record<string, unknown>>(
  scope: ViewScope,
): UseViewPreferenceResult<T> {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const queryKey = ['view-preferences', workspaceId, scope] as const;
  // Written on every filter change; a ref keeps the latest without re-rendering.
  const pending = useRef<T | null>(null);

  const { data } = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      apiQuery<ViewPreferenceResponse<T>>({ url: `/view-preferences/${scope}`, signal }),
    staleTime: PREFERENCE_STALE_TIME,
    enabled: Boolean(workspaceId),
  });

  const save = useCallback(
    (next: T) => {
      pending.current = next;
      queryClient.setQueryData(queryKey, { state: next });
      void api.put(`/view-preferences/${scope}`, { state: next }).catch(() => {
        // A preference that failed to stick is not worth a toast.
      });
    },
    // biome-ignore lint/correctness/useExhaustiveDependencies: queryKey is derived from the two below
    [queryClient, scope, workspaceId],
  );

  return { state: data?.state, save };
}
