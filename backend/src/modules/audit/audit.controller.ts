import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseEnumPipe,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaResponse } from '../../common/effect/schema-response';
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
  @SchemaResponse(WorkspaceActivity)
  async activity(@WorkspaceId() workspaceId: string, @Query('limit') limitRaw?: string) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return { items: await this.auditService.findWorkspaceActivity(workspaceId, limit) };
  }

  @Get('entity/:entityType/:entityId')
  @WorkspaceAuth(Permission.AUDIT_VIEW)
  @SchemaResponse(AuditEventList)
  async getByEntity(
    @Param('entityType', new ParseEnumPipe(EntityType)) entityType: EntityType,
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
  @SchemaResponse(AuditRollbackResult)
  async rollback(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(appError('AUDIT_ROLLBACK_ADMIN_ONLY'));
    }
    return this.auditService.rollback(id, user.id, workspaceId);
  }
}
