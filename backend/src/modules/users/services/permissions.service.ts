import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Permission, ROLE_PERMISSIONS } from '../../../common/enums/permissions.enum';
import { AuditAction, EntityType, Severity } from '../../../entities/audit-event.entity';
import { User, UserRole } from '../../../entities/user.entity';
import { WorkspaceMember } from '../../../entities/workspace-member.entity';
import { AuditService } from '../../audit/audit.service';
import { recordSecurityEvent } from '../../auth/security-audit.util';
import { findUserOrThrow, getCurrentPermissions, withCurrentPermissions } from './permissions.util';

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(WorkspaceMember)
    private workspaceMemberRepository: Repository<WorkspaceMember>,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Loads the target user, but only if they belong to the workspace the caller
   * is acting in. Without this, holding USER_MANAGE in one workspace was enough
   * to rewrite the permissions of any user in any other workspace.
   */
  async findUserInWorkspace(userId: string, workspaceId: string): Promise<User> {
    const membership = await this.workspaceMemberRepository.findOne({
      where: { userId, workspaceId },
    });

    if (!membership) {
      throw new NotFoundException('User not found');
    }

    return findUserOrThrow(this.userRepository.findOne({ where: { id: userId } }));
  }

  /**
   * A caller may only grant permissions they themselves hold: otherwise anyone
   * with USER_MANAGE could bootstrap themselves (or an accomplice) up to full
   * administrative access. Global admins hold every permission, so they are
   * unaffected by this check.
   */
  private assertCanGrant(actor: User, permissions: Permission[]): void {
    const actorPermissions = this.getUserPermissions(actor);
    const notHeld = permissions.filter(permission => !actorPermissions.includes(permission));

    if (notHeld.length > 0) {
      throw new ForbiddenException(
        `Cannot grant permissions you do not hold: ${notHeld.join(', ')}`,
      );
    }
  }

  /**
   * Get all permissions for a user (custom + role-based)
   */
  getUserPermissions(user: User): Permission[] {
    // Admin has all permissions
    if (user.role === UserRole.ADMIN) {
      return Object.values(Permission);
    }

    // If user has custom permissions, merge with role-based
    const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
    const customPermissions = getCurrentPermissions(user);

    // Merge and deduplicate
    return [...new Set([...rolePermissions, ...customPermissions])];
  }

  /**
   * Check if user has a specific permission
   */
  hasPermission(user: User, permission: Permission): boolean {
    return this.getUserPermissions(user).includes(permission);
  }

  /**
   * Check if user has any of the specified permissions
   */
  hasAnyPermission(user: User, permissions: Permission[]): boolean {
    const userPermissions = this.getUserPermissions(user);
    return permissions.some(permission => userPermissions.includes(permission));
  }

  /**
   * Check if user has all of the specified permissions
   */
  hasAllPermissions(user: User, permissions: Permission[]): boolean {
    const userPermissions = this.getUserPermissions(user);
    return permissions.every(permission => userPermissions.includes(permission));
  }

  /**
   * Update user permissions
   */
  async updateUserPermissions(
    userId: string,
    permissions: Permission[],
    actor: User,
    workspaceId: string,
  ): Promise<User> {
    this.assertCanGrant(actor, permissions);
    const user = await this.findUserInWorkspace(userId, workspaceId);
    const before = user.permissions ?? null;

    user.permissions = permissions;
    const saved = await this.userRepository.save(user);
    await this.recordPermissionChange(workspaceId, actor.id, userId, before, saved, 'update');
    return saved;
  }

  /**
   * Add permission to user
   */
  async addPermission(
    userId: string,
    permission: Permission,
    actor: User,
    workspaceId: string,
  ): Promise<User> {
    this.assertCanGrant(actor, [permission]);
    const user = await this.findUserInWorkspace(userId, workspaceId);

    return withCurrentPermissions(user, async (loadedUser, currentPermissions) => {
      if (!currentPermissions.includes(permission)) {
        loadedUser.permissions = [...currentPermissions, permission];
        const saved = await this.userRepository.save(loadedUser);
        await this.recordPermissionChange(
          workspaceId,
          actor.id,
          userId,
          currentPermissions,
          saved,
          'add',
        );
        return saved;
      }

      return loadedUser;
    });
  }

  /**
   * Remove permission from user
   */
  async removePermission(
    userId: string,
    permission: Permission,
    workspaceId: string,
    actorId: string,
  ): Promise<User> {
    const user = await this.findUserInWorkspace(userId, workspaceId);

    return withCurrentPermissions(user, async (loadedUser, currentPermissions) => {
      loadedUser.permissions = currentPermissions.filter(p => p !== permission);
      const saved = await this.userRepository.save(loadedUser);
      await this.recordPermissionChange(
        workspaceId,
        actorId,
        userId,
        currentPermissions,
        saved,
        'remove',
      );
      return saved;
    });
  }

  /**
   * Reset user permissions to role defaults
   */
  async resetPermissions(userId: string, workspaceId: string, actorId: string): Promise<User> {
    const user = await this.findUserInWorkspace(userId, workspaceId);
    const before = user.permissions ?? null;

    user.permissions = null;
    const saved = await this.userRepository.save(user);
    await this.recordPermissionChange(workspaceId, actorId, userId, before, saved, 'reset');
    return saved;
  }

  private async recordPermissionChange(
    workspaceId: string,
    actorId: string,
    targetUserId: string,
    before: string[] | null,
    saved: User,
    operation: 'update' | 'add' | 'remove' | 'reset',
  ): Promise<void> {
    await recordSecurityEvent(this.auditService, this.logger, {
      workspaceId,
      actorId,
      entityType: EntityType.USER,
      entityId: targetUserId,
      action: AuditAction.UPDATE,
      severity: Severity.WARN,
      diff: { before: { permissions: before }, after: { permissions: saved.permissions ?? null } },
      meta: { permissionChange: operation },
    });
  }
}
