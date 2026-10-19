import { ForbiddenException } from '@nestjs/common';
import { StatementStage } from '@/entities/statement.entity';
import { WorkspaceRole } from '@/entities/workspace-member.entity';
import { StatementStageService } from '@/modules/statements/services/statement-stage.service';

type Row = { id: string; userId: string; stage: StatementStage; deletedAt?: Date | null };

const WORKSPACE = 'ws-1';
const ME = 'user-me';

function buildService(options: {
  statements: Row[];
  uncategorized?: Record<string, number>;
  role?: WorkspaceRole | null;
  permissions?: Record<string, boolean>;
  /** Ids the guarded UPDATE reports back; defaults to every id it was given. */
  updateReturns?: (ids: string[]) => string[];
}) {
  const updateCalls: Array<{ ids: string[]; source: string; target: string; workspaceId: string }> =
    [];

  const updateBuilder = () => {
    const state: Record<string, unknown> = {};
    const builder = {
      update: () => builder,
      set: (values: { stage: string }) => {
        state.target = values.stage;
        return builder;
      },
      where: (_sql: string, params: { ids: string[] }) => {
        state.ids = params.ids;
        return builder;
      },
      andWhere: (_sql: string, params: Record<string, string>) => {
        Object.assign(state, params);
        return builder;
      },
      returning: () => builder,
      execute: async () => {
        const ids = state.ids as string[];
        updateCalls.push({
          ids,
          source: state.source as string,
          target: state.target as string,
          workspaceId: state.workspaceId as string,
        });
        const returned = options.updateReturns ? options.updateReturns(ids) : ids;
        return { raw: returned.map(id => ({ id })) };
      },
    };
    return builder;
  };

  const statementRepository = {
    find: jest.fn(async () => options.statements.map(row => ({ deletedAt: null, ...row }))),
    createQueryBuilder: jest.fn(updateBuilder),
  };

  const uncategorizedRows = Object.entries(options.uncategorized ?? {}).map(
    ([statementId, count]) => ({ statementId, count: String(count) }),
  );
  const countBuilder = {
    leftJoin: () => countBuilder,
    select: () => countBuilder,
    addSelect: () => countBuilder,
    where: () => countBuilder,
    andWhere: () => countBuilder,
    groupBy: () => countBuilder,
    getRawMany: async () => uncategorizedRows,
  };
  const transactionRepository = { createQueryBuilder: jest.fn(() => countBuilder) };

  const membership =
    options.role === null
      ? null
      : {
          role: options.role ?? WorkspaceRole.MEMBER,
          // A member writes only where a toggle says so; these cases are about
          // stage movement, so the toggle is on unless a case sets it.
          permissions: options.permissions ?? { canEditStatements: true },
        };
  const workspaceMemberRepository = { findOne: jest.fn(async () => membership) };
  const userRepository = { findOne: jest.fn(async () => ({ id: ME, email: 'me@example.com' })) };
  const auditService = { createBatchEvents: jest.fn(async () => ({ batchId: 'b', events: [] })) };

  const service = new StatementStageService(
    statementRepository as never,
    transactionRepository as never,
    workspaceMemberRepository as never,
    userRepository as never,
    auditService as never,
  );

  return { service, statementRepository, auditService, updateCalls };
}

describe('StatementStageService.updateStage', () => {
  it('moves submittable statements and reports the uncategorised one as skipped', async () => {
    const { service, updateCalls, auditService } = buildService({
      statements: [
        { id: 's1', userId: ME, stage: StatementStage.SUBMIT },
        { id: 's2', userId: ME, stage: StatementStage.SUBMIT },
      ],
      uncategorized: { s2: 1 },
    });

    const result = await service.updateStage(['s1', 's2'], StatementStage.APPROVE, ME, WORKSPACE);

    expect(result).toEqual({
      updated: ['s1'],
      skipped: [{ id: 's2', code: 'UNCATEGORIZED_TRANSACTIONS' }],
    });
    expect(updateCalls).toEqual([
      { ids: ['s1'], source: 'submit', target: 'approve', workspaceId: WORKSPACE },
    ]);
    const [events] = auditService.createBatchEvents.mock.calls[0] as unknown as [
      Array<{ entityId: string; diff: unknown }>,
    ];
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      entityId: 's1',
      diff: { before: { stage: 'submit' }, after: { stage: 'approve' } },
    });
  });

  it('only looks statements up inside the caller workspace', async () => {
    const { service, statementRepository } = buildService({ statements: [] });

    const result = await service.updateStage(['foreign'], StatementStage.APPROVE, ME, WORKSPACE);

    expect(statementRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: WORKSPACE }),
      }),
    );
    expect(result).toEqual({
      updated: [],
      skipped: [{ id: 'foreign', code: 'STATEMENT_NOT_FOUND' }],
    });
  });

  it('treats trashed statements as not found', async () => {
    const { service, updateCalls } = buildService({
      statements: [
        { id: 's1', userId: ME, stage: StatementStage.SUBMIT, deletedAt: new Date('2026-09-01') },
      ],
    });

    const result = await service.updateStage(['s1'], StatementStage.APPROVE, ME, WORKSPACE);

    expect(result.skipped).toEqual([{ id: 's1', code: 'STATEMENT_NOT_FOUND' }]);
    expect(updateCalls).toHaveLength(0);
  });

  it("lets a plain member move only their own statements", async () => {
    const { service } = buildService({
      role: WorkspaceRole.MEMBER,
      statements: [
        { id: 'mine', userId: ME, stage: StatementStage.APPROVE },
        { id: 'theirs', userId: 'someone-else', stage: StatementStage.APPROVE },
      ],
    });

    const result = await service.updateStage(
      ['mine', 'theirs'],
      StatementStage.SUBMIT,
      ME,
      WORKSPACE,
    );

    expect(result).toEqual({
      updated: ['mine'],
      skipped: [{ id: 'theirs', code: 'STATEMENT_EDIT_FORBIDDEN' }],
    });
  });

  it('lets a workspace admin move statements uploaded by others', async () => {
    const { service } = buildService({
      role: WorkspaceRole.ADMIN,
      statements: [{ id: 'theirs', userId: 'someone-else', stage: StatementStage.APPROVE }],
    });

    const result = await service.updateStage(['theirs'], StatementStage.PAY, ME, WORKSPACE);

    expect(result).toEqual({ updated: ['theirs'], skipped: [] });
  });

  it('refuses a member whose statement-edit permission is off', async () => {
    const { service } = buildService({
      role: WorkspaceRole.MEMBER,
      permissions: { canEditStatements: false },
      statements: [{ id: 's1', userId: ME, stage: StatementStage.SUBMIT }],
    });

    await expect(
      service.updateStage(['s1'], StatementStage.APPROVE, ME, WORKSPACE),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('is a no-op for statements already in the target stage (safe retry)', async () => {
    const { service, updateCalls, auditService } = buildService({
      statements: [{ id: 's1', userId: ME, stage: StatementStage.APPROVE }],
    });

    const result = await service.updateStage(['s1'], StatementStage.APPROVE, ME, WORKSPACE);

    expect(result).toEqual({ updated: ['s1'], skipped: [] });
    expect(updateCalls).toHaveLength(0);
    expect(auditService.createBatchEvents).not.toHaveBeenCalled();
  });

  it('groups the guarded UPDATE by source stage', async () => {
    const { service, updateCalls } = buildService({
      role: WorkspaceRole.OWNER,
      statements: [
        { id: 'a', userId: ME, stage: StatementStage.SUBMIT },
        { id: 'p', userId: ME, stage: StatementStage.PAY },
      ],
    });

    await service.updateStage(['a', 'p'], StatementStage.APPROVE, ME, WORKSPACE);

    expect(updateCalls.map(call => [call.source, call.ids])).toEqual([
      ['submit', ['a']],
      ['pay', ['p']],
    ]);
  });

  it('reports a statement moved by someone else between read and write', async () => {
    const { service, auditService } = buildService({
      statements: [
        { id: 's1', userId: ME, stage: StatementStage.SUBMIT },
        { id: 's2', userId: ME, stage: StatementStage.SUBMIT },
      ],
      updateReturns: ids => ids.filter(id => id !== 's2'),
    });

    const result = await service.updateStage(['s1', 's2'], StatementStage.APPROVE, ME, WORKSPACE);

    expect(result).toEqual({
      updated: ['s1'],
      skipped: [{ id: 's2', code: 'INVALID_STAGE_TRANSITION' }],
    });
    const [events] = auditService.createBatchEvents.mock.calls[0] as unknown as [
      Array<{ entityId: string }>,
    ];
    expect(events.map(event => event.entityId)).toEqual(['s1']);
  });

  it('ignores duplicate ids in the request', async () => {
    const { service, updateCalls } = buildService({
      statements: [{ id: 's1', userId: ME, stage: StatementStage.SUBMIT }],
    });

    const result = await service.updateStage(['s1', 's1'], StatementStage.APPROVE, ME, WORKSPACE);

    expect(result.updated).toEqual(['s1']);
    expect(updateCalls[0].ids).toEqual(['s1']);
  });
});
