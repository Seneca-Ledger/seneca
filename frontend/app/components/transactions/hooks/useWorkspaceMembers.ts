'use client';

import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/app/hooks/useAuth';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { apiQuery } from '@/app/lib/query-fn';
import { queryKeys } from '@/app/lib/query-keys';

/** How long the member list is good for: people join a household rarely. */
const MEMBERS_STALE_TIME = 5 * 60 * 1000;

export interface WorkspaceMemberOption {
  /** The membership row — what a transaction's `ownerMemberId` points at. */
  memberId: string;
  /** Display name, falling back to the email. */
  label: string;
  isSelf: boolean;
}

interface WorkspaceMemberRecord {
  id: string;
  memberId?: string;
  name?: string;
  email?: string;
}

interface WorkspaceOverview {
  members: WorkspaceMemberRecord[];
}

/**
 * The members of the workspace, or nothing at all when there is only one.
 *
 * Deliberately free of `useAuth`: the Review badge needs the count on every
 * page, and tying it to the auth context would drag a provider into places
 * that only want a number.
 */
export function useHouseholdMembers(): Array<WorkspaceMemberRecord & { memberId: string }> {
  const workspaceId = useWorkspaceId();

  const { data } = useQuery({
    queryKey: queryKeys.workspaceMembers(workspaceId),
    queryFn: ({ signal }) => apiQuery<WorkspaceOverview>({ url: '/workspaces/me', signal }),
    staleTime: MEMBERS_STALE_TIME,
  });

  const members = data?.members ?? [];
  if (members.length < 2) {
    return [];
  }

  return members.filter((member): member is WorkspaceMemberRecord & { memberId: string } =>
    Boolean(member.memberId),
  );
}

/**
 * The people a transaction can belong to.
 *
 * Returns an empty list for a workspace of one, so a solo user never sees an
 * owner control they have nobody to use it with.
 */
export function useWorkspaceMembers(): WorkspaceMemberOption[] {
  const { user } = useAuth();
  const members = useHouseholdMembers();

  return members.map(member => ({
    memberId: member.memberId,
    label: member.name || member.email || member.memberId,
    isSelf: member.id === user?.id,
  }));
}
