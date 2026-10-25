import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { WorkspaceKind } from '../../entities/workspace.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { ALLOW_IN_VERSION_KEY } from '../decorators/allow-in-version.decorator';
import { appError } from '../errors/app-error';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

/** Methods that read: the only ones a past version answers, unless a route says otherwise. */
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class WorkspaceContextGuard implements CanActivate {
  constructor(
    private readonly dataSource: DataSource,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const workspaceId = request.headers['x-workspace-id'] as string;
    const user = request.user;

    if (!workspaceId) {
      throw new ForbiddenException('Workspace context is required');
    }

    if (!user?.id) {
      throw new ForbiddenException('User not authenticated');
    }

    const membership = await this.dataSource.getRepository(WorkspaceMember).findOne({
      where: { workspaceId, userId: user.id },
      relations: {
        workspace: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    if (membership.workspace?.kind === WorkspaceKind.VERSION) {
      this.assertVersionAccess(context, request, membership.workspace.ownerId);
    }

    request.workspace = membership.workspace;
    request.workspaceRole = membership.role;
    request.workspaceMemberId = membership.id;
    request.workspaceMemberPermissions = membership.permissions;

    return true;
  }

  /**
   * A past version is a copy of the books as they were: only the person who
   * opened it looks at it, and nothing in it changes.
   */
  private assertVersionAccess(
    context: ExecutionContext,
    request: AuthenticatedRequest,
    ownerId: string | null,
  ): void {
    if (ownerId !== request.user?.id) {
      throw new ForbiddenException(appError('VERSION_OWNER_ONLY'));
    }
    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_IN_VERSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!(READ_METHODS.has(request.method.toUpperCase()) || allowed)) {
      throw new ForbiddenException(appError('VERSION_READ_ONLY'));
    }
  }
}
