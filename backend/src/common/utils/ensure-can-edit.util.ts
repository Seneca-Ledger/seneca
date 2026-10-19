import { ForbiddenException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type {
  WorkspaceMember,
  WorkspaceMemberPermissions,
} from '../../entities/workspace-member.entity';
import { workspaceMemberCanEdit } from '../authz/workspace-permissions';
import { appError, type ErrorCode } from '../errors/app-error';

/**
 * Checks that the given user has permission to perform an edit operation in the workspace.
 *
 * Owners and admins always pass, viewers never do, and a plain member passes only
 * where the matching toggle in `workspace_members.permissions` is `true`. The
 * rules live in `workspaceMemberCanEdit` so that the guard and the services that
 * run outside it cannot drift apart.
 */
export async function ensureCanEdit(
  workspaceMemberRepository: Repository<WorkspaceMember>,
  workspaceId: string,
  userId: string,
  permissionKey: keyof WorkspaceMemberPermissions,
  errorCode: ErrorCode,
): Promise<void> {
  if (!workspaceId) {
    return;
  }

  const membership = await workspaceMemberRepository.findOne({
    where: { workspaceId, userId },
    select: ['role', 'permissions'],
  });

  // No membership row means the caller reached here outside the workspace
  // guard; that request is rejected before it gets this far.
  if (!membership) {
    return;
  }

  if (!workspaceMemberCanEdit(membership.role, permissionKey, membership.permissions)) {
    throw new ForbiddenException(appError(errorCode));
  }
}
