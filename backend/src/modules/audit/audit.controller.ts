import { Controller, ForbiddenException, Get, Post, UseInterceptors } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaParams, SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { toEnum } from '../../common/effect/to-enum';
import { Permission } from '../../common/enums/permissions.enum';
import { appError } from '../../common/errors/app-error';
import { HideInternalColumnsInterceptor } from '../../common/interceptors/hide-internal-columns.interceptor';
import { StripKeysInterceptor } from '../../common/interceptors/strip-keys.interceptor';
import { ACCOUNT_KEYS } from '../../common/utils/sensitive-keys.util';
import {
  AuditEventList,
  AuditEventPage,
  AuditRollbackResult,
  WorkspaceActivity,
} from '../../contracts';
import {
  AuditBatchParams,
  AuditEntityParams,
  AuditEventParams,
  AuditEventsQuery,
  WorkspaceActivityQuery,
} from '../../contracts/requests/audit';
import { ActorType, AuditAction, EntityType, Severity } from '../../entities/audit-event.entity';
import { type User, UserRole } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditService } from './audit.service';

@Controller('audit-events')
// Events join their actor's account row; members see the person only.
// Events written before the trail was cleaned still hold account details: strip them on the way out.
@UseInterceptors(HideInternalColumnsInterceptor, new StripKeysInterceptor(ACCOUNT_KEYS))
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @WorkspaceAuth(Permission.AUDIT_VIEW)
  @SchemaResponse(AuditEventPage)
  async list(
    @WorkspaceId() workspaceIdFromContext: string,
    @SchemaQuery(AuditEventsQuery) query: AuditEventsQuery,
  ) {
    return this.auditService.findEvents({
      ...query,
      workspaceId: workspaceIdFromContext,
      entityType: toEnum(EntityType, query.entityType),
      actorType: toEnum(ActorType, query.actorType),
      action: toEnum(AuditAction, query.action),
      severity: toEnum(Severity, query.severity),
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
  @SchemaResponse(WorkspaceActivity)
  async activity(
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(WorkspaceActivityQuery) { limit }: WorkspaceActivityQuery,
  ) {
    return { items: await this.auditService.findWorkspaceActivity(workspaceId, limit) };
  }

  @Get('entity/:entityType/:entityId')
  @WorkspaceAuth(Permission.AUDIT_VIEW)
  @SchemaResponse(AuditEventList)
  async getByEntity(
    @SchemaParams(AuditEntityParams) { entityType, entityId }: AuditEntityParams,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.auditService.findEventsByEntity(
      toEnum(EntityType, entityType),
      entityId,
      workspaceId,
    );
  }

  @Get('batch/:batchId')
  @WorkspaceAuth(Permission.AUDIT_VIEW)
  async getByBatch(
    @SchemaParams(AuditBatchParams) { batchId }: AuditBatchParams,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.auditService.findEventsByBatch(batchId, workspaceId);
  }

  @Get(':id')
  @WorkspaceAuth(Permission.AUDIT_VIEW)
  async getOne(
    @SchemaParams(AuditEventParams) { id }: AuditEventParams,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.auditService.findEventById(id, workspaceId);
  }

  @Post(':id/rollback')
  @WorkspaceAuth(Permission.AUDIT_VIEW)
  @SchemaResponse(AuditRollbackResult)
  async rollback(
    @SchemaParams(AuditEventParams) { id }: AuditEventParams,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(appError('AUDIT_ROLLBACK_ADMIN_ONLY'));
    }
    return this.auditService.rollback(id, user.id, workspaceId);
  }
}
