import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type User, UserRole } from '../../entities/user.entity';
import type {
  WorkspaceMemberPermissions,
  WorkspaceRole,
} from '../../entities/workspace-member.entity';
import { workspaceRoleAllows } from '../authz/workspace-permissions';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import type { Permission } from '../enums/permissions.enum';
import { Permission as PermissionEnum, ROLE_PERMISSIONS } from '../enums/permissions.enum';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true; // No permissions required
    }

    const request = context.switchToHttp().getRequest();
    const user: User = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }
    // A scoped API key is narrower than its owner, admin or not.
    const apiKey = request.apiKey as { scopes: string[] | null } | undefined;
    if (apiKey?.scopes && apiKey.scopes.length > 0) {
      const missing = requiredPermissions.filter(
        permission => !apiKey.scopes?.includes(permission),
      );
      if (missing.length > 0) {
        throw new ForbiddenException(`API key scope missing: ${missing.join(', ')}`);
      }
    }

    // Admin has all permissions
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    // Get user permissions (custom or role-based)
    const userPermissions = this.getUserPermissions(user);

    // Check if user has all required permissions
    const hasAllPermissions = requiredPermissions.every(permission =>
      userPermissions.includes(permission),
    );

    if (hasAllPermissions) {
      return true;
    }

    const workspaceRole = request.workspaceRole as WorkspaceRole | undefined;
    const workspaceMemberPermissions = request.workspaceMemberPermissions as
      | WorkspaceMemberPermissions
      | null
      | undefined;

    if (
      this.hasWorkspacePermission(requiredPermissions, workspaceRole, workspaceMemberPermissions)
    ) {
      return true;
    }

    throw new ForbiddenException(
      `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`,
    );
  }

  private getUserPermissions(user: User): Permission[] {
    // If user has custom permissions, use them
    if (user.permissions && user.permissions.length > 0) {
      return this.withAuditAliases(user.permissions as Permission[]);
    }

    // Otherwise, use role-based permissions
    return this.withAuditAliases(ROLE_PERMISSIONS[user.role] || []);
  }

  private withAuditAliases(permissions: Permission[]): Permission[] {
    const normalized = new Set(permissions);
    if (normalized.has(PermissionEnum.AUDIT_LOG_VIEW)) {
      normalized.add(PermissionEnum.AUDIT_VIEW);
    }
    if (normalized.has(PermissionEnum.AUDIT_VIEW)) {
      normalized.add(PermissionEnum.AUDIT_LOG_VIEW);
    }
    return Array.from(normalized);
  }

  private hasWorkspacePermission(
    requiredPermissions: Permission[],
    workspaceRole?: WorkspaceRole,
    workspaceMemberPermissions?: WorkspaceMemberPermissions | null,
  ): boolean {
    return requiredPermissions.every(permission =>
      workspaceRoleAllows(permission, workspaceRole, workspaceMemberPermissions),
    );
  }
}
