'use client';

import { useQuery } from '@tanstack/react-query';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { apiQuery } from '@/app/lib/query-fn';
import { queryKeys } from '@/app/lib/query-keys';

/** Which first steps this workspace has taken, from `GET /dashboard/setup-progress`. */
export interface SetupProgress {
  hasUpload: boolean;
  hasCustomCategories: boolean;
  hasBudget: boolean;
  hasGoal: boolean;
}

/**
 * Always refetched on mount: someone who just created a goal and came back to
 * the dashboard must see it ticked off, not a 30-second-old answer.
 */
export function useSetupProgress(): SetupProgress | undefined {
  const workspaceId = useWorkspaceId();
  const { data } = useQuery({
    queryKey: queryKeys.dashboardSetupProgress(workspaceId),
    queryFn: ({ signal }) => apiQuery<SetupProgress>({ url: '/dashboard/setup-progress', signal }),
    staleTime: 0,
    enabled: Boolean(workspaceId),
  });
  return data;
}
