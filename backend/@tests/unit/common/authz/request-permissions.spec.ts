import { assertPermissions, hasPermissions } from '@/common/authz/request-permissions';
import { Permission } from '@/common/enums/permissions.enum';
import { UserRole } from '@/entities/user.entity';
import { WorkspaceRole } from '@/entities/workspace-member.entity';
import { ForbiddenException } from '@nestjs/common';

const user = (role: UserRole, permissions: string[] | null = null) =>
  ({ role, permissions }) as never;

describe('request permissions', () => {
  it('lets a scoped key do only what its scopes name, even for an admin', () => {
    const subject = {
      user: user(UserRole.ADMIN),
      apiKey: { scopes: [Permission.TRANSACTION_VIEW] },
    };

    expect(hasPermissions([Permission.TRANSACTION_VIEW], subject)).toBe(true);
    expect(hasPermissions([Permission.CATEGORY_CREATE], subject)).toBe(false);
    expect(() => assertPermissions([Permission.CATEGORY_CREATE], subject)).toThrow(
      'API key scope missing: category.create',
    );
  });

  it('gives a key without scopes the reach of its owner', () => {
    const subject = { user: user(UserRole.ADMIN), apiKey: { scopes: null } };

    expect(hasPermissions([Permission.CATEGORY_CREATE], subject)).toBe(true);
  });

  it('falls back to the workspace role when the account role does not grant it', () => {
    const viewer = {
      user: user(UserRole.USER, []),
      workspaceRole: WorkspaceRole.VIEWER,
      workspaceMemberPermissions: null,
    };

    expect(hasPermissions([Permission.TRANSACTION_VIEW], viewer)).toBe(true);
    expect(() => assertPermissions([Permission.TRANSACTION_EDIT], viewer)).toThrow(
      ForbiddenException,
    );
  });

  it('requires nothing when nothing is required', () => {
    expect(() =>
      assertPermissions([], { user: user(UserRole.USER, []), apiKey: { scopes: ['x'] } }),
    ).not.toThrow();
  });
});
