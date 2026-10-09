import {
  GLOBAL_ONLY_PERMISSIONS,
  MEMBER_PERMISSION_GATES,
  MEMBER_PERMISSIONS,
  WORKSPACE_READ_PERMISSIONS,
  workspaceMemberCanEdit,
  workspaceRoleAllows,
} from '@/common/authz/workspace-permissions';
import { Permission } from '@/common/enums/permissions.enum';
import type { WorkspaceMemberPermissions } from '@/entities/workspace-member.entity';
import { WorkspaceRole } from '@/entities/workspace-member.entity';

const ALL_TOGGLES: WorkspaceMemberPermissions = {
  canEditStatements: true,
  canEditCustomTables: true,
  canEditCategories: true,
  canEditDataEntry: true,
  canShareFiles: true,
};

const WRITE_PERMISSIONS = Object.values(Permission).filter(
  permission =>
    !WORKSPACE_READ_PERMISSIONS.has(permission) && !GLOBAL_ONLY_PERMISSIONS.has(permission),
);

describe('workspaceRoleAllows', () => {
  it('puts no permission in two buckets', () => {
    const buckets = [
      GLOBAL_ONLY_PERMISSIONS,
      WORKSPACE_READ_PERMISSIONS,
      MEMBER_PERMISSIONS,
      new Set(Object.keys(MEMBER_PERMISSION_GATES) as Permission[]),
    ];

    const doubled = Object.values(Permission).filter(
      permission => buckets.filter(bucket => bucket.has(permission)).length > 1,
    );

    expect(doubled).toEqual([]);
  });

  // Anything not named in a bucket falls through to owner/admin. Pinning the
  // list here means a new Permission cannot land there unnoticed.
  it('leaves exactly these permissions to the owner and admins', () => {
    const adminOnly = Object.values(Permission).filter(
      permission =>
        !GLOBAL_ONLY_PERMISSIONS.has(permission) &&
        !WORKSPACE_READ_PERMISSIONS.has(permission) &&
        !MEMBER_PERMISSIONS.has(permission) &&
        !(permission in MEMBER_PERMISSION_GATES),
    );

    expect(adminOnly.sort()).toEqual(
      [
        Permission.AUDIT_LOG_VIEW,
        Permission.AUDIT_VIEW,
        Permission.BRANCH_CREATE,
        Permission.BRANCH_DELETE,
        Permission.BRANCH_EDIT,
        Permission.BUDGET_CREATE,
        Permission.BUDGET_DELETE,
        Permission.BUDGET_EDIT,
        Permission.CLIENT_CREATE,
        Permission.CLIENT_DELETE,
        Permission.CLIENT_EDIT,
        Permission.GOAL_CREATE,
        Permission.GOAL_DELETE,
        Permission.GOAL_EDIT,
        Permission.INTEGRATION_MANAGE,
        Permission.INVOICE_CREATE,
        Permission.INVOICE_DELETE,
        Permission.INVOICE_EDIT,
        Permission.LEDGER_MANAGE_ACCOUNTS,
        Permission.LEDGER_POST,
        Permission.PAYABLE_CREATE,
        Permission.PAYABLE_DELETE,
        Permission.PAYABLE_EDIT,
        Permission.SUBSCRIPTION_CREATE,
        Permission.SUBSCRIPTION_DELETE,
        Permission.SUBSCRIPTION_EDIT,
        Permission.TELEGRAM_CONNECT,
        Permission.TELEGRAM_SEND,
        Permission.WALLET_CREATE,
        Permission.WALLET_DELETE,
        Permission.WALLET_EDIT,
        Permission.WORKSPACE_SETTINGS_MANAGE,
      ].sort(),
    );
  });

  it('keeps instance-admin permissions out of every workspace role', () => {
    for (const permission of GLOBAL_ONLY_PERMISSIONS) {
      for (const role of Object.values(WorkspaceRole)) {
        expect(workspaceRoleAllows(permission, role, ALL_TOGGLES)).toBe(false);
      }
    }
  });

  it('lets every role read the workspace', () => {
    for (const permission of WORKSPACE_READ_PERMISSIONS) {
      for (const role of Object.values(WorkspaceRole)) {
        expect(workspaceRoleAllows(permission, role, null)).toBe(true);
      }
    }
  });

  it('denies a viewer every write, even with all toggles switched on', () => {
    for (const permission of WRITE_PERMISSIONS) {
      expect(workspaceRoleAllows(permission, WorkspaceRole.VIEWER, ALL_TOGGLES)).toBe(false);
    }
  });

  it.each([WorkspaceRole.OWNER, WorkspaceRole.ADMIN])(
    'gives %s every workspace-scoped permission without any toggle',
    role => {
      for (const permission of WRITE_PERMISSIONS) {
        expect(workspaceRoleAllows(permission, role, null)).toBe(true);
      }
    },
  );

  it('denies a member every write when the column is missing', () => {
    for (const permission of WRITE_PERMISSIONS) {
      if (MEMBER_PERMISSIONS.has(permission)) {
        continue;
      }
      expect(workspaceRoleAllows(permission, WorkspaceRole.MEMBER, null)).toBe(false);
    }
  });

  it('grants a member exactly the writes its toggles name', () => {
    for (const permission of WRITE_PERMISSIONS) {
      const expected =
        MEMBER_PERMISSIONS.has(permission) || permission in MEMBER_PERMISSION_GATES;
      expect(workspaceRoleAllows(permission, WorkspaceRole.MEMBER, ALL_TOGGLES)).toBe(expected);
    }
  });

  it('honours a single toggle without leaking into the others', () => {
    const statementsOnly: WorkspaceMemberPermissions = { canEditStatements: true };

    expect(
      workspaceRoleAllows(Permission.TRANSACTION_EDIT, WorkspaceRole.MEMBER, statementsOnly),
    ).toBe(true);
    expect(
      workspaceRoleAllows(Permission.CATEGORY_CREATE, WorkspaceRole.MEMBER, statementsOnly),
    ).toBe(false);
  });

  it('turns a write off when the toggle is explicitly false', () => {
    const denied: WorkspaceMemberPermissions = { ...ALL_TOGGLES, canEditCategories: false };

    expect(workspaceRoleAllows(Permission.CATEGORY_EDIT, WorkspaceRole.MEMBER, denied)).toBe(false);
    expect(workspaceRoleAllows(Permission.STATEMENT_EDIT, WorkspaceRole.MEMBER, denied)).toBe(true);
  });

  it('refuses everything without a workspace role', () => {
    expect(workspaceRoleAllows(Permission.TRANSACTION_VIEW, undefined, ALL_TOGGLES)).toBe(false);
    expect(workspaceRoleAllows(Permission.TRANSACTION_EDIT, null, ALL_TOGGLES)).toBe(false);
  });

  // The bugs this table replaced: goals and report export reached no branch of
  // the old if-chain, so they were 403 for the workspace owner too.
  it.each([
    Permission.GOAL_CREATE,
    Permission.GOAL_EDIT,
    Permission.GOAL_DELETE,
    Permission.REPORT_EXPORT,
  ])('lets the workspace owner use %s', permission => {
    expect(workspaceRoleAllows(permission, WorkspaceRole.OWNER, null)).toBe(true);
  });
});

describe('workspaceMemberCanEdit', () => {
  it.each([WorkspaceRole.OWNER, WorkspaceRole.ADMIN])('lets %s edit without a column', role => {
    expect(workspaceMemberCanEdit(role, 'canEditDataEntry', null)).toBe(true);
  });

  it('never lets a viewer edit', () => {
    expect(workspaceMemberCanEdit(WorkspaceRole.VIEWER, 'canEditDataEntry', ALL_TOGGLES)).toBe(
      false,
    );
    expect(workspaceMemberCanEdit(WorkspaceRole.VIEWER, 'canShareFiles', ALL_TOGGLES)).toBe(false);
  });

  it('requires an explicit true from a member', () => {
    expect(workspaceMemberCanEdit(WorkspaceRole.MEMBER, 'canEditCustomTables', null)).toBe(false);
    expect(workspaceMemberCanEdit(WorkspaceRole.MEMBER, 'canEditCustomTables', {})).toBe(false);
    expect(
      workspaceMemberCanEdit(WorkspaceRole.MEMBER, 'canEditCustomTables', {
        canEditCustomTables: false,
      }),
    ).toBe(false);
    expect(
      workspaceMemberCanEdit(WorkspaceRole.MEMBER, 'canEditCustomTables', {
        canEditCustomTables: true,
      }),
    ).toBe(true);
  });
});
