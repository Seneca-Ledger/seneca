import {
  applyOwnerFilter,
  assertOwnerMemberInWorkspace,
  parseOwnerFilter,
  parseReviewerFilter,
} from '@/common/utils/transaction-owner.util';
import type { WorkspaceMember } from '@/entities/workspace-member.entity';
import { BadRequestException } from '@nestjs/common';
import type { Repository, SelectQueryBuilder } from 'typeorm';

const SELF = 'member-self';

describe('parseOwnerFilter', () => {
  it.each([undefined, null, '', '   '])('treats %p as the whole workspace', value => {
    expect(parseOwnerFilter(value, SELF)).toEqual({ kind: 'all' });
  });

  it('reads "shared" as the rows nobody claimed, not as "no filter"', () => {
    expect(parseOwnerFilter('shared', SELF)).toEqual({ kind: 'shared' });
  });

  it('resolves "me" against the caller’s own membership', () => {
    expect(parseOwnerFilter('me', SELF)).toEqual({ kind: 'member', memberId: SELF });
  });

  it('falls back to the whole workspace when "me" has no membership to resolve', () => {
    expect(parseOwnerFilter('me', null)).toEqual({ kind: 'all' });
  });

  it('takes anything else as a membership id', () => {
    expect(parseOwnerFilter('member-partner', SELF)).toEqual({
      kind: 'member',
      memberId: 'member-partner',
    });
  });
});

describe('applyOwnerFilter', () => {
  const builder = () => {
    const calls: Array<[string, Record<string, unknown> | undefined]> = [];
    const qb = {
      calls,
      andWhere(condition: string, params?: Record<string, unknown>) {
        calls.push([condition, params]);
        return qb;
      },
    };
    return qb as unknown as SelectQueryBuilder<unknown> & { calls: typeof calls };
  };

  it('leaves the query alone for the whole workspace', () => {
    const qb = builder();
    applyOwnerFilter(qb, 'transaction', { kind: 'all' });
    expect(qb.calls).toEqual([]);
  });

  it('matches NULL for shared rows', () => {
    const qb = builder();
    applyOwnerFilter(qb, 'transaction', { kind: 'shared' });
    expect(qb.calls).toEqual([['transaction.ownerMemberId IS NULL', undefined]]);
  });

  it('binds the member id instead of inlining it', () => {
    const qb = builder();
    applyOwnerFilter(qb, 'transaction', { kind: 'member', memberId: 'm-1' });
    expect(qb.calls).toEqual([
      ['transaction.ownerMemberId = :ownerMemberId', { ownerMemberId: 'm-1' }],
    ]);
  });

  it('matches mine or unclaimed for a review queue', () => {
    const qb = builder();
    applyOwnerFilter(qb, 't', { kind: 'memberOrShared', memberId: 'm-1' });
    expect(qb.calls).toEqual([
      [
        '(t.ownerMemberId IS NULL OR t.ownerMemberId = :ownerMemberId)',
        { ownerMemberId: 'm-1' },
      ],
    ]);
  });
});

describe('parseReviewerFilter', () => {
  it('turns "me" into mine-plus-shared, not strictly mine', () => {
    // Every row starts shared, so a strictly-mine queue would hide the
    // household's own backlog from everyone.
    expect(parseReviewerFilter('me', SELF)).toEqual({
      kind: 'memberOrShared',
      memberId: SELF,
    });
  });

  it.each([undefined, null, '', 'anyone', 'everyone'])(
    'treats %p as the whole workspace',
    value => {
      expect(parseReviewerFilter(value, SELF)).toEqual({ kind: 'all' });
    },
  );

  it('falls back to the whole workspace when there is no membership to resolve', () => {
    expect(parseReviewerFilter('me', null)).toEqual({ kind: 'all' });
  });
});

describe('assertOwnerMemberInWorkspace', () => {
  const repo = (exists: boolean) =>
    ({ exists: jest.fn(async () => exists) }) as unknown as Repository<WorkspaceMember> & {
      exists: jest.Mock;
    };

  it.each([null, undefined])('accepts %p as clearing the owner', async value => {
    const repository = repo(false);
    await expect(assertOwnerMemberInWorkspace(repository, 'ws-1', value)).resolves.toBeUndefined();
    expect(repository.exists).not.toHaveBeenCalled();
  });

  it('accepts a membership of this workspace', async () => {
    const repository = repo(true);
    await expect(assertOwnerMemberInWorkspace(repository, 'ws-1', 'm-1')).resolves.toBeUndefined();
    expect(repository.exists).toHaveBeenCalledWith({ where: { id: 'm-1', workspaceId: 'ws-1' } });
  });

  it('refuses a membership borrowed from another workspace', async () => {
    const repository = repo(false);
    await expect(assertOwnerMemberInWorkspace(repository, 'ws-1', 'm-other')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
