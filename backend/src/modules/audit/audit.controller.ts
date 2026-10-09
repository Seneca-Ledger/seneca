import { Controller, ForbiddenException, Get, Param, Post, Query } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { Permission } from '../../common/enums/permissions.enum';
import { ActorType, AuditAction, EntityType, Severity } from '../../entities/audit-event.entity';
import { type User, UserRole } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditService } from './audit.service';

@Controller('audit-events')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @WorkspaceAuth(Permission.AUDIT_VIEW)
  async list(
    @WorkspaceId() workspaceIdFromContext: string,
    @Query('entityType') entityType?: EntityType,
    @Query('entityId') entityId?: string,
    @Query('actorType') actorType?: ActorType,
    @Query('actorId') actorId?: string,
    @Query('action') action?: AuditAction,
    @Query('actorLabel') actorLabel?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('batchId') batchId?: string,
    @Query('severity') severity?: Severity,
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const page = pageRaw ? Number(pageRaw) : undefined;
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.auditService.findEvents({
      workspaceId: workspaceIdFromContext,
      entityType,
      entityId,
      actorType,
      actorId,
      action,
      actorLabel,
      dateFrom,
      dateTo,
      batchId,
      severity,
      page,
      limit,
    });
  }

  /**
   * Who in the household did what lately.
   *
   * Behind `TRANSACTION_VIEW`, not `AUDIT_VIEW`: everyone sharing the money can
   * see each other move it. The full audit — sign-ins, keys, member changes,
   * before/after of every edit — stays with the owner and the admins.
   */
  @Get('activity')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  async activity(@WorkspaceId() workspaceId: string, @Query('limit') limitRaw?: string) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return { items: await this.auditService.findWorkspaceActivity(workspaceId, limit) };
  }

  @Get('entity/:entityType/:entityId')
  @WorkspaceAuth(Permission.AUDIT_VIEW)
  async getByEntity(
    @Param('entityType') entityType: EntityType,
    @Param('entityId') entityId: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.auditService.findEventsByEntity(entityType, entityId, workspaceId);
  }

  @Get('batch/:batchId')
  @WorkspaceAuth(Permission.AUDIT_VIEW)
  async getByBatch(@Param('batchId') batchId: string, @WorkspaceId() workspaceId: string) {
    return this.auditService.findEventsByBatch(batchId, workspaceId);
  }

  @Get(':id')
  @WorkspaceAuth(Permission.AUDIT_VIEW)
  async getOne(@Param('id') id: string, @WorkspaceId() workspaceId: string) {
    return this.auditService.findEventById(id, workspaceId);
  }

  @Post(':id/rollback')
  @WorkspaceAuth(Permission.AUDIT_VIEW)
  async rollback(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can rollback audit events');
    }
    return this.auditService.rollback(id, user.id, workspaceId);
  }
}
