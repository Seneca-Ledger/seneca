'use client';

import { useHouseholdMembers } from '@/app/components/transactions/hooks/useWorkspaceMembers';

/** What the queue and the badge agree to show when nobody picked. */
export type Reviewer = 'me' | 'anyone';

/**
 * Whose backlog to show by default.
 *
 * In a household, mine — otherwise the badge counts rows the other person owns
 * and sends you to a queue that will not show them. A workspace of one has no
 * second person, so there is nothing to filter and the question never arises.
 */
export function useDefaultReviewer(): Reviewer {
  return useHouseholdMembers().length > 0 ? 'me' : 'anyone';
}
