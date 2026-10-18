'use client';

import { useQuery } from '@tanstack/react-query';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

// Stable fallback: a fresh `{}` on every render would re-run every memo keyed on it.
const NO_COUNTS: Record<string, number> = {};

/**
 * Rows each statement still has in Review, keyed by statement id. Shares the
 * `review-inbox` key prefix, so a decision taken in Review refreshes it.
 */
export function useStatementReviewCounts(enabled: boolean): Record<string, number> {
  const workspaceId = useWorkspaceId();
  const query = useQuery({
    queryKey: queryKeys.reviewInboxByStatement(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: '/review-inbox/statements',
        signal,
        contract: 'ReviewInboxByStatement',
      }),
    enabled: enabled && Boolean(workspaceId),
  });
  return query.data ?? NO_COUNTS;
}
