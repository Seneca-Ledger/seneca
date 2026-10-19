import {
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaResponse } from '../../common/effect/schema-response';
import { toEnum } from '../../common/effect/to-enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { buildContentDisposition } from '../../common/utils/http-file.util';
import {
  CreateCustomTableShareBody,
  CreateExportScheduleBody,
  SharedTableRows,
  SharedTableView,
} from '../../contracts';
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
  async createShare(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) tableId: string,
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
  async listShares(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) tableId: string,
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
  async createExportSchedule(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) tableId: string,
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
  async listExportSchedules(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) tableId: string,
  ) {
    const items = await this.exportSchedulesService.listSchedules(workspaceId, tableId);
    return { items };
  }

  @Delete(':id/export-schedules/:scheduleId')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  async deleteExportSchedule(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) _tableId: string,
    @Param('scheduleId', new ParseUUIDPipe()) scheduleId: string,
  ) {
    await this.exportSchedulesService.deleteSchedule(user.id, workspaceId, scheduleId);
    return { message: 'Schedule deleted' };
  }

  @Get(':id/export-schedules/:scheduleId/file')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  async downloadScheduledExport(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) _tableId: string,
    @Param('scheduleId', new ParseUUIDPipe()) scheduleId: string,
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
  async revokeShare(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) _tableId: string,
    @Param('shareId', new ParseUUIDPipe()) shareId: string,
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
  async getSharedTable(@Param('token') token: string) {
    return this.sharesService.getSharedTable(token);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get(':token/rows')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  @Header('Cache-Control', 'no-store')
  @SchemaResponse(SharedTableRows)
  async getSharedRows(
    @Param('token') token: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const cursorNumber = cursor ? Number(cursor) : undefined;
    const limitNumber = limit ? Number(limit) : undefined;
    const { items, total } = await this.sharesService.getSharedRows(token, {
      cursor: Number.isFinite(cursorNumber) ? cursorNumber : undefined,
      limit: Number.isFinite(limitNumber) ? limitNumber : undefined,
    });
    return { items, meta: { total } };
  }
}
