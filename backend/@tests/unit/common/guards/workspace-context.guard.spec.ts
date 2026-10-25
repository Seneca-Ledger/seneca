import { ALLOW_IN_VERSION_KEY } from '@/common/decorators/allow-in-version.decorator';
import { appError } from '@/common/errors/app-error';
import { WorkspaceContextGuard } from '@/common/guards/workspace-context.guard';
import { WorkspaceMember, WorkspaceRole } from '@/entities/workspace-member.entity';
import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';

describe('WorkspaceContextGuard', () => {
  let testingModule: TestingModule;
  let guard: WorkspaceContextGuard;
  let mockRepository: { findOne: jest.Mock };
  let mockDataSource: { getRepository: jest.Mock };

  const mockWorkspace = { id: 'ws-1', name: 'Test Workspace' };
  const mockMembership: Partial<WorkspaceMember> = {
    workspaceId: 'ws-1',
    userId: 'user-1',
    role: WorkspaceRole.MEMBER,
    permissions: null,
    workspace: mockWorkspace as any,
  };

  function makeContext(
    overrides: {
      workspaceId?: string | null;
      userId?: string | null;
      extra?: Record<string, unknown>;
    } = {},
  ): ExecutionContext {
    const { workspaceId = 'ws-1', userId = 'user-1', extra = {} } = overrides;
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            ...(workspaceId !== null ? { 'x-workspace-id': workspaceId } : {}),
          },
          user: userId !== null ? { id: userId } : null,
          ...extra,
        }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeAll(async () => {
    mockRepository = { findOne: jest.fn() };
    mockDataSource = {
      getRepository: jest.fn().mockReturnValue(mockRepository),
    };

    testingModule = await Test.createTestingModule({
      providers: [
        WorkspaceContextGuard,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    guard = testingModule.get<WorkspaceContextGuard>(WorkspaceContextGuard);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await testingModule.close();
  });

  it('allows request and enriches context when user is workspace member', async () => {
    mockRepository.findOne.mockResolvedValue(mockMembership);
    const request: Record<string, unknown> = {};
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-workspace-id': 'ws-1' },
          user: { id: 'user-1' },
          ...request,
        }),
      }),
    } as unknown as ExecutionContext;

    // Mutate the request object to check enrichment
    const req: any = context.switchToHttp().getRequest();
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('sets workspace, workspaceRole, and workspaceMemberPermissions on request', async () => {
    const req: any = {
      headers: { 'x-workspace-id': 'ws-1' },
      user: { id: 'user-1' },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    mockRepository.findOne.mockResolvedValue(mockMembership);

    await guard.canActivate(context);

    expect(req.workspace).toBe(mockWorkspace);
    expect(req.workspaceRole).toBe(WorkspaceRole.MEMBER);
    expect(req.workspaceMemberPermissions).toBeNull();
  });

  it('throws ForbiddenException when x-workspace-id header is missing', async () => {
    const context = makeContext({ workspaceId: null });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(context)).rejects.toThrow('Workspace context is required');
  });

  it('throws ForbiddenException when x-workspace-id header is empty string', async () => {
    const context = makeContext({ workspaceId: '' });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when user is not authenticated (null user)', async () => {
    const context = makeContext({ userId: null });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(context)).rejects.toThrow('User not authenticated');
  });

  it('throws ForbiddenException when user has no id', async () => {
    const req: any = {
      headers: { 'x-workspace-id': 'ws-1' },
      user: {},
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(context)).rejects.toThrow('User not authenticated');
  });

  it('throws ForbiddenException when user is not a member of the workspace', async () => {
    mockRepository.findOne.mockResolvedValue(null);
    const context = makeContext();

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(context)).rejects.toThrow(
      'You are not a member of this workspace',
    );
  });

  it('queries database with correct workspaceId and userId', async () => {
    mockRepository.findOne.mockResolvedValue(mockMembership);
    const context = makeContext({ workspaceId: 'ws-42', userId: 'user-99' });

    await guard.canActivate(context);

    expect(mockRepository.findOne).toHaveBeenCalledWith({
      where: { workspaceId: 'ws-42', userId: 'user-99' },
      relations: { workspace: true },
    });
  });

  it('sets OWNER role when user is workspace owner', async () => {
    const ownerMembership = { ...mockMembership, role: WorkspaceRole.OWNER };
    mockRepository.findOne.mockResolvedValue(ownerMembership);

    const req: any = {
      headers: { 'x-workspace-id': 'ws-1' },
      user: { id: 'user-1' },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    await guard.canActivate(context);

    expect(req.workspaceRole).toBe(WorkspaceRole.OWNER);
  });

  describe('a past version', () => {
    const version = {
      ...mockMembership,
      role: WorkspaceRole.OWNER,
      workspace: { id: 'ws-v', kind: 'version', ownerId: 'user-1' } as any,
    };
    const readOnly = () => {};
    const exportOnly = () => {};
    Reflect.defineMetadata(ALLOW_IN_VERSION_KEY, true, exportOnly);

    const versionContext = (method: string, handler = readOnly, userId = 'user-1') =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({ method, headers: { 'x-workspace-id': 'ws-v' }, user: { id: userId } }),
        }),
        getHandler: () => handler,
        getClass: () => class Controller {},
      }) as unknown as ExecutionContext;

    const codeOf = async (promise: Promise<unknown>) => {
      try {
        await promise;
        return 'allowed';
      } catch (error) {
        return ((error as ForbiddenException).getResponse() as { code?: string }).code;
      }
    };

    beforeEach(() => mockRepository.findOne.mockResolvedValue(version));

    it('answers reads', async () => {
      expect(await codeOf(guard.canActivate(versionContext('GET')))).toBe('allowed');
    });

    it('refuses every change with a code that does not read as lost access', async () => {
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        expect(await codeOf(guard.canActivate(versionContext(method)))).toBe('VERSION_READ_ONLY');
      }
      // The client resets the workspace on a 403 whose message says "workspace".
      expect(appError('VERSION_READ_ONLY').message).not.toMatch(/workspace/);
      expect(appError('VERSION_OWNER_ONLY').message).not.toMatch(/workspace/);
    });

    it('lets through a POST that only reads', async () => {
      expect(await codeOf(guard.canActivate(versionContext('POST', exportOnly)))).toBe('allowed');
    });

    it('is for the person who opened it alone', async () => {
      expect(await codeOf(guard.canActivate(versionContext('GET', readOnly, 'user-2')))).toBe(
        'VERSION_OWNER_ONLY',
      );
    });

    it('leaves an ordinary workspace as it was', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockMembership,
        workspace: { id: 'ws-1', kind: 'standard', ownerId: 'someone-else' },
      });
      const context = versionContext('DELETE');
      expect(await codeOf(guard.canActivate(context))).toBe('allowed');
    });
  });
});
