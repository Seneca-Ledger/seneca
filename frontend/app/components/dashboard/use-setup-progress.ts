'use client';

import { useQuery } from '@tanstack/react-query';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import type { SetupProgress } from '@/app/lib/contracts';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

export type { SetupProgress };

/**
 * Always refetched on mount: someone who just created a goal and came back to
 * the dashboard must see it ticked off, not a 30-second-old answer.
 */
export function useSetupProgress(): SetupProgress | undefined {
  const workspaceId = useWorkspaceId();
  const { data } = useQuery({
    queryKey: queryKeys.dashboardSetupProgress(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/dashboard/setup-progress', signal, contract: 'SetupProgress' }),
    staleTime: 0,
    enabled: Boolean(workspaceId),
  });
  return data;
}
