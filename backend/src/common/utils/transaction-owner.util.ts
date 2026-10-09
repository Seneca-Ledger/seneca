import { BadRequestException } from '@nestjs/common';
import type { Repository, SelectQueryBuilder } from 'typeorm';
import type { WorkspaceMember } from '../../entities/workspace-member.entity';
import { appError } from '../errors/app-error';

/**
 * Who a list of transactions is being looked at as.
 *
 * `shared` is not "no filter": it is the rows nobody claimed, which is what a
 * household wants when it asks "what do we spend together". No filter at all is
 * the whole workspace, and that stays the default.
 */
export type OwnerFilter =
  | { kind: 'all' }
  | { kind: 'shared' }
  | { kind: 'member'; memberId: string }
  /**
   * Mine, plus everything nobody claimed. "Not someone else's", which is what a
   * review queue wants: shared is the default state of every row, so a queue of
   * strictly-mine rows would leave the household's own backlog invisible.
   */
  | { kind: 'memberOrShared'; memberId: string };

/** The word for "nobody claimed this", in query params and in rule conditions. */
export const OWNER_SHARED = 'shared';
/** The word for "whoever is asking", resolved server-side. */
export const OWNER_ME = 'me';

/**
 * Reads the `owner` query parameter: `me`, `shared`, a membership id, or
 * nothing. `me` is resolved here rather than by the client so a page can link
 * to "my spending" without first knowing its own membership id.
 */
export function parseOwnerFilter(
  owner: string | undefined | null,
  selfMemberId: string | null,
): OwnerFilter {
  const value = owner?.trim();
  if (!value) {
    return { kind: 'all' };
  }
  if (value === OWNER_SHARED) {
    return { kind: 'shared' };
  }
  if (value === OWNER_ME) {
    // Someone who is not a member of this workspace never gets here: the
    // workspace guard rejects the request first.
    return selfMemberId ? { kind: 'member', memberId: selfMemberId } : { kind: 'all' };
  }
  return { kind: 'member', memberId: value };
}

/** Narrows a transaction query to one owner. `all` leaves the query alone. */
export function applyOwnerFilter<T>(
  query: SelectQueryBuilder<T>,
  alias: string,
  filter: OwnerFilter,
): SelectQueryBuilder<T> {
  if (filter.kind === 'all') {
    return query;
  }
  if (filter.kind === 'shared') {
    return query.andWhere(`${alias}.ownerMemberId IS NULL`);
  }
  if (filter.kind === 'memberOrShared') {
    return query.andWhere(
      `(${alias}.ownerMemberId IS NULL OR ${alias}.ownerMemberId = :ownerMemberId)`,
      { ownerMemberId: filter.memberId },
    );
  }
  return query.andWhere(`${alias}.ownerMemberId = :ownerMemberId`, {
    ownerMemberId: filter.memberId,
  });
}

/**
 * Reads the review queue's `reviewer` parameter: `me` is mine and the household's,
 * anything else is the whole workspace.
 */
export function parseReviewerFilter(
  reviewer: string | undefined | null,
  selfMemberId: string | null,
): OwnerFilter {
  return reviewer?.trim() === OWNER_ME && selfMemberId
    ? { kind: 'memberOrShared', memberId: selfMemberId }
    : { kind: 'all' };
}

/**
 * Checks that an owner being written belongs to this workspace, so a membership
 * id borrowed from another tenant cannot be stored. `null` clears the owner and
 * needs no check.
 */
export async function assertOwnerMemberInWorkspace(
  workspaceMemberRepository: Repository<WorkspaceMember>,
  workspaceId: string,
  ownerMemberId: string | null | undefined,
): Promise<void> {
  if (!ownerMemberId) {
    return;
  }
  const exists = await workspaceMemberRepository.exists({
    where: { id: ownerMemberId, workspaceId },
  });
  if (!exists) {
    throw new BadRequestException(appError('MEMBER_NOT_FOUND'));
  }
}
