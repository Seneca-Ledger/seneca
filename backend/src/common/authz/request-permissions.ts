import { ForbiddenException } from '@nestjs/common';
import { type User, UserRole } from '../../entities/user.entity';
import type {
  WorkspaceMemberPermissions,
  WorkspaceRole,
} from '../../entities/workspace-member.entity';
import { Permission, ROLE_PERMISSIONS } from '../enums/permissions.enum';
import { workspaceRoleAllows } from './workspace-permissions';

/** Who is asking: the user, the API key they came with, and their membership. */
export interface PermissionSubject {
  user: Pick<User, 'role' | 'permissions'>;
  apiKey?: { scopes: string[] | null } | null;
  workspaceRole?: WorkspaceRole | null;
  workspaceMemberPermissions?: WorkspaceMemberPermissions | null;
}

const withAuditAliases = (permissions: Permission[]): Permission[] => {
  const normalized = new Set(permissions);
  if (normalized.has(Permission.AUDIT_LOG_VIEW)) {
    normalized.add(Permission.AUDIT_VIEW);
  }
  if (normalized.has(Permission.AUDIT_VIEW)) {
    normalized.add(Permission.AUDIT_LOG_VIEW);
  }
  return Array.from(normalized);
};

const userPermissions = (user: PermissionSubject['user']): Permission[] =>
  withAuditAliases(
    user.permissions && user.permissions.length > 0
      ? (user.permissions as Permission[])
      : ROLE_PERMISSIONS[user.role] || [],
  );

/** The required permissions a scoped API key does not carry; empty for unscoped keys. */
const missingScopes = (
  required: readonly Permission[],
  apiKey: PermissionSubject['apiKey'],
): Permission[] => {
  const scopes = apiKey?.scopes;
  return scopes && scopes.length > 0 ? required.filter(p => !scopes.includes(p)) : [];
};

/** Whether the user's account or workspace role grants every required permission. */
const roleAllows = (required: readonly Permission[], subject: PermissionSubject): boolean => {
  if (subject.user.role === UserRole.ADMIN) {
    return true;
  }
  const granted = userPermissions(subject.user);
  if (required.every(permission => granted.includes(permission))) {
    return true;
  }
  return required.every(permission =>
    workspaceRoleAllows(
      permission,
      subject.workspaceRole ?? undefined,
      subject.workspaceMemberPermissions,
    ),
  );
};

/**
 * Throws what `PermissionsGuard` answers when `subject` may not do something
 * that needs `required`. A scoped API key is narrower than its owner, admin
 * or not; then the account role, then the workspace role decide.
 */
export function assertPermissions(
  required: readonly Permission[],
  subject: PermissionSubject,
): void {
  if (required.length === 0) {
    return;
  }
  assertApiKeyScopes(required, subject.apiKey);
  if (!roleAllows(required, subject)) {
    throw new ForbiddenException(`Insufficient permissions. Required: ${required.join(', ')}`);
  }
}

/**
 * The API-key half of `assertPermissions`, for routes whose role rule lives in
 * the service (a per-target toggle) and so cannot sit behind `PermissionsGuard`.
 */
export function assertApiKeyScopes(
  required: readonly Permission[],
  apiKey: PermissionSubject['apiKey'],
): void {
  const missing = missingScopes(required, apiKey);
  if (missing.length > 0) {
    throw new ForbiddenException(`API key scope missing: ${missing.join(', ')}`);
  }
}

export function hasPermissions(
  required: readonly Permission[],
  subject: PermissionSubject,
): boolean {
  return missingScopes(required, subject.apiKey).length === 0 && roleAllows(required, subject);
}
