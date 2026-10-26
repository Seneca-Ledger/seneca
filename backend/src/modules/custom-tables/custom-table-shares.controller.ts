import { Controller, Delete, Get, Header, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams, SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { toEnum } from '../../common/effect/to-enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { buildContentDisposition } from '../../common/utils/http-file.util';
import {
  CreateCustomTableShareBody,
  CreateExportScheduleBody,
  MessageResult,
  SharedTableRows,
  SharedTableView,
} from '../../contracts';
import {
  CustomTableShareCreated,
  CustomTableShareList,
  ExportScheduleItem,
  ExportScheduleList,
} from '../../contracts/custom-tables/custom-table-collab';
import {
  CustomTableParams,
  CustomTableScheduleParams,
  CustomTableShareParams,
  SharedTableParams,
  SharedTableRowsQuery,
} from '../../contracts/requests/custom-table-queries';
import { ExportScheduleFormat } from '../../entities/custom-table-export-schedule.entity';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CustomTableExportSchedulesService } from './custom-table-export-schedules.service';
import { CustomTableSharesService } from './custom-table-shares.service';

/** Управление ссылками — обычный приватный API под JWT. */
@Controller('custom-tables')
@UseGuards(JwtAuthGuard)
export class CustomTableSharesController {
  constructor(
    private readonly sharesService: CustomTableSharesService,
    private readonly exportSchedulesService: CustomTableExportSchedulesService,
  ) {}

  @Post(':id/shares')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  @SchemaResponse(CustomTableShareCreated)
  async createShare(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(CustomTableParams) { id: tableId }: CustomTableParams,
    @SchemaBody(CreateCustomTableShareBody) dto: CreateCustomTableShareBody,
  ) {
    const { share, token } = await this.sharesService.createShare(user.id, workspaceId, tableId, {
      expiresInDays: dto.expiresInDays ?? undefined,
    });
    return {
      id: share.id,
      token,
      expiresAt: share.expiresAt,
      status: share.status,
    };
  }

  @Get(':id/shares')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  @SchemaResponse(CustomTableShareList)
  async listShares(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(CustomTableParams) { id: tableId }: CustomTableParams,
  ) {
    const items = await this.sharesService.listShares(workspaceId, tableId);
    return {
      items: items.map(share => ({
        id: share.id,
        token: share.token,
        status: share.status,
        expiresAt: share.expiresAt,
        accessCount: share.accessCount,
        lastAccessedAt: share.lastAccessedAt,
        createdAt: share.createdAt,
      })),
    };
  }

  @Post(':id/export-schedules')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  @SchemaResponse(ExportScheduleItem)
  async createExportSchedule(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(CustomTableParams) { id: tableId }: CustomTableParams,
    @SchemaBody(CreateExportScheduleBody) dto: CreateExportScheduleBody,
  ) {
    return this.exportSchedulesService.createSchedule(user.id, workspaceId, tableId, {
      ...dto,
      intervalHours: dto.intervalHours ?? undefined,
      format: toEnum(ExportScheduleFormat, dto.format) ?? undefined,
    });
  }

  @Get(':id/export-schedules')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  @SchemaResponse(ExportScheduleList)
  async listExportSchedules(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(CustomTableParams) { id: tableId }: CustomTableParams,
  ) {
    const items = await this.exportSchedulesService.listSchedules(workspaceId, tableId);
    return { items };
  }

  @Delete(':id/export-schedules/:scheduleId')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  @SchemaResponse(MessageResult)
  async deleteExportSchedule(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(CustomTableScheduleParams) { scheduleId }: CustomTableScheduleParams,
  ) {
    await this.exportSchedulesService.deleteSchedule(user.id, workspaceId, scheduleId);
    return { message: 'Schedule deleted' };
  }

  @Get(':id/export-schedules/:scheduleId/file')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  async downloadScheduledExport(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(CustomTableScheduleParams) { scheduleId }: CustomTableScheduleParams,
    @Res() res: Response,
  ) {
    const { buffer, fileName } = await this.exportSchedulesService.readLastFile(
      workspaceId,
      scheduleId,
    );
    res.setHeader('Content-Disposition', buildContentDisposition('attachment', fileName));
    res.setHeader('Content-Length', String(buffer.length));
    res.end(buffer);
  }

  @Delete(':id/shares/:shareId')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  @SchemaResponse(MessageResult)
  async revokeShare(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(CustomTableShareParams) { shareId }: CustomTableShareParams,
  ) {
    await this.sharesService.revokeShare(user.id, workspaceId, shareId);
    return { message: 'Link revoked' };
  }
}

/**
 * Публичный просмотр по ссылке. Отдельный контроллер, потому что здесь нет
 * ни JWT, ни контекста воркспейса — доступ определяет только сам токен.
 */
@Controller('public/custom-tables')
export class PublicCustomTableSharesController {
  constructor(private readonly sharesService: CustomTableSharesService) {}

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get(':token')
  // Ссылка не должна попасть в поисковую выдачу.
  @Header('X-Robots-Tag', 'noindex, nofollow')
  @Header('Cache-Control', 'no-store')
  @SchemaResponse(SharedTableView)
  async getSharedTable(@SchemaParams(SharedTableParams) { token }: SharedTableParams) {
    return this.sharesService.getSharedTable(token);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get(':token/rows')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  @Header('Cache-Control', 'no-store')
  @SchemaResponse(SharedTableRows)
  async getSharedRows(
    @SchemaParams(SharedTableParams) { token }: SharedTableParams,
    @SchemaQuery(SharedTableRowsQuery) query: SharedTableRowsQuery,
  ) {
    const { items, total } = await this.sharesService.getSharedRows(token, query);
    return { items, meta: { total } };
  }
}
