import { ForbiddenException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { ensureCanEdit } from '../../common/utils/ensure-can-edit.util';
import { type WorkspaceMember, WorkspaceRole } from '../../entities';
import type { Statement } from '../../entities/statement.entity';

/** Whether the member may add or change documents in the workspace at all. */
export async function ensureCanEditStatements(
  members: Repository<WorkspaceMember>,
  userId: string,
  workspaceId: string,
): Promise<void> {
  await ensureCanEdit(
    members,
    workspaceId,
    userId,
    'canEditStatements',
    'STATEMENTS_EDIT_FORBIDDEN',
  );
}

/**
 * Whether the member may change this document: their own, or any document of
 * the workspace for its owners and admins.
 */
export async function ensureCanModifyStatement(
  members: Repository<WorkspaceMember>,
  statement: Statement,
  userId: string,
  workspaceId: string,
): Promise<void> {
  await ensureCanEditStatements(members, userId, workspaceId);
  if (statement.userId === userId) {
    return;
  }
  if (workspaceId && statement.workspaceId === workspaceId) {
    const membership = await members.findOne({
      where: { workspaceId, userId },
      select: {
        role: true,
      },
    });
    if (membership && [WorkspaceRole.ADMIN, WorkspaceRole.OWNER].includes(membership.role)) {
      return;
    }
  }
  throw new ForbiddenException(appError('STATEMENT_EDIT_FORBIDDEN'));
}
