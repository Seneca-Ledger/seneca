import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

@Injectable()
export class WorkspaceContextGuard implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}

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
      relations: ['workspace'],
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    request.workspace = membership.workspace;
    request.workspaceRole = membership.role;
    request.workspaceMemberId = membership.id;
    request.workspaceMemberPermissions = membership.permissions;

    return true;
  }
}
