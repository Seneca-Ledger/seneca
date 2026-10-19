import { type Permission, Permission as PermissionEnum } from '@/common/enums/permissions.enum';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { UserRole } from '@/entities/user.entity';
import { WorkspaceRole } from '@/entities/workspace-member.entity';
import { type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';

describe('PermissionsGuard', () => {
  let testingModule: TestingModule;
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeAll(async () => {
    testingModule = await Test.createTestingModule({
      providers: [
        PermissionsGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = testingModule.get<PermissionsGuard>(PermissionsGuard);
    reflector = testingModule.get<Reflector>(Reflector);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await testingModule.close();
  });

  it('refuses a scoped API key outside its scopes, even for an admin, and allows inside them', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([PermissionEnum.STATEMENT_UPLOAD] as Permission[]);

    const readOnly = createMockExecutionContext({
      user: { id: 'admin', role: UserRole.ADMIN, permissions: null },
      workspaceRole: WorkspaceRole.OWNER,
      workspaceMemberPermissions: null,
      apiKey: { scopes: [PermissionEnum.TRANSACTION_VIEW] },
    });
    expect(() => guard.canActivate(readOnly)).toThrow(/API key scope missing/);

    const writer = createMockExecutionContext({
      user: { id: 'admin', role: UserRole.ADMIN, permissions: null },
      workspaceRole: WorkspaceRole.OWNER,
      workspaceMemberPermissions: null,
      apiKey: { scopes: [PermissionEnum.STATEMENT_UPLOAD] },
    });
    expect(guard.canActivate(writer)).toBe(true);

    // A key made before scopes existed keeps its owner's reach.
    const legacy = createMockExecutionContext({
      user: { id: 'admin', role: UserRole.ADMIN, permissions: null },
      workspaceRole: WorkspaceRole.OWNER,
      workspaceMemberPermissions: null,
      apiKey: { scopes: null },
    });
    expect(guard.canActivate(legacy)).toBe(true);
  });

  it('allows workspace owner to upload statements', () => {
    const context = createMockExecutionContext({
      user: { id: 'user-1', role: UserRole.USER, permissions: null },
      workspaceRole: WorkspaceRole.OWNER,
      workspaceMemberPermissions: null,
    });
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([PermissionEnum.STATEMENT_UPLOAD] as Permission[]);

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('allows member with edit statements permission to upload statements', () => {
    const context = createMockExecutionContext({
      user: { id: 'user-2', role: UserRole.USER, permissions: null },
      workspaceRole: WorkspaceRole.MEMBER,
      workspaceMemberPermissions: { canEditStatements: true },
    });
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([PermissionEnum.STATEMENT_UPLOAD] as Permission[]);

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('allows workspace owner to view audit log', () => {
    const context = createMockExecutionContext({
      user: { id: 'user-3', role: UserRole.USER, permissions: null },
      workspaceRole: WorkspaceRole.OWNER,
      workspaceMemberPermissions: null,
    });
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([PermissionEnum.AUDIT_VIEW] as Permission[]);

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('allows workspace admin to view audit log', () => {
    const context = createMockExecutionContext({
      user: { id: 'user-4', role: UserRole.USER, permissions: null },
      workspaceRole: WorkspaceRole.ADMIN,
      workspaceMemberPermissions: null,
    });
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([PermissionEnum.AUDIT_VIEW] as Permission[]);

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('allows workspace owner to create a budget', () => {
    const context = createMockExecutionContext({
      user: { id: 'user-5', role: UserRole.USER, permissions: null },
      workspaceRole: WorkspaceRole.OWNER,
      workspaceMemberPermissions: null,
    });
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([PermissionEnum.BUDGET_CREATE] as Permission[]);

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('denies plain member from creating a budget', () => {
    const context = createMockExecutionContext({
      user: { id: 'user-6', role: UserRole.USER, permissions: null },
      workspaceRole: WorkspaceRole.MEMBER,
      workspaceMemberPermissions: null,
    });
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([PermissionEnum.BUDGET_CREATE] as Permission[]);

    expect(() => guard.canActivate(context)).toThrow();
  });

  it.each([
    PermissionEnum.TRANSACTION_EDIT,
    PermissionEnum.STATEMENT_DELETE,
    PermissionEnum.CATEGORY_CREATE,
  ])('denies a workspace viewer %s even with every toggle set', permission => {
    // A viewer used to pass every edit branch: the UI never sends toggles for
    // the role, and a missing toggle was read as "not forbidden".
    const context = createMockExecutionContext({
      user: { id: 'viewer-1', role: UserRole.USER, permissions: null },
      workspaceRole: WorkspaceRole.VIEWER,
      workspaceMemberPermissions: {
        canEditStatements: true,
        canEditCustomTables: true,
        canEditCategories: true,
        canEditDataEntry: true,
        canShareFiles: true,
      },
    });
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([permission] as Permission[]);

    expect(() => guard.canActivate(context)).toThrow(/Insufficient permissions/);
  });

  it('lets a member create categories once canEditCategories is on, and not before', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([PermissionEnum.CATEGORY_CREATE] as Permission[]);

    const withoutToggle = createMockExecutionContext({
      user: { id: 'member-1', role: UserRole.USER, permissions: null },
      workspaceRole: WorkspaceRole.MEMBER,
      workspaceMemberPermissions: { canEditStatements: true },
    });
    expect(() => guard.canActivate(withoutToggle)).toThrow();

    const withToggle = createMockExecutionContext({
      user: { id: 'member-1', role: UserRole.USER, permissions: null },
      workspaceRole: WorkspaceRole.MEMBER,
      workspaceMemberPermissions: { canEditCategories: true },
    });
    expect(guard.canActivate(withToggle)).toBe(true);
  });

  it.each([PermissionEnum.GOAL_CREATE, PermissionEnum.REPORT_EXPORT])(
    'lets a workspace owner use %s',
    permission => {
      const context = createMockExecutionContext({
        user: { id: 'owner-1', role: UserRole.USER, permissions: null },
        workspaceRole: WorkspaceRole.OWNER,
        workspaceMemberPermissions: null,
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([permission] as Permission[]);

      expect(guard.canActivate(context)).toBe(true);
    },
  );

  it.each([PermissionEnum.WORKSPACE_SETTINGS_MANAGE, PermissionEnum.INTEGRATION_MANAGE])(
    'allows workspace owner to use workspace admin permission %s',
    permission => {
      const context = createMockExecutionContext({
        user: { id: 'user-5', role: UserRole.USER, permissions: null },
        workspaceRole: WorkspaceRole.OWNER,
        workspaceMemberPermissions: null,
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([permission] as Permission[]);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    },
  );
});

function createMockExecutionContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {},
        user: null,
        workspaceRole: undefined,
        workspaceMemberPermissions: undefined,
        ...request,
      }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}
