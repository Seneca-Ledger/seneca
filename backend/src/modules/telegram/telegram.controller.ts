import { Controller, Get, Post, Query } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { ConnectTelegramBody, SendTelegramReportBody, TelegramReportPage } from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TelegramService } from './telegram.service';

@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post('connect')
  @WorkspaceAuth(Permission.TELEGRAM_CONNECT)
  async connect(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(ConnectTelegramBody) dto: ConnectTelegramBody,
  ) {
    const updated = await this.telegramService.connectAccount(user, workspaceId, dto);
    return {
      userId: updated.id,
      telegramId: updated.telegramId,
      telegramChatId: updated.telegramChatId,
    };
  }

  @Get('reports')
  @WorkspaceAuth(Permission.TELEGRAM_VIEW)
  @SchemaResponse(TelegramReportPage)
  async listReports(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const currentPage = page ? Number.parseInt(page, 10) : 1;
    const pageSize = limit ? Number.parseInt(limit, 10) : 20;
    return this.telegramService.listReports(user, currentPage, pageSize);
  }

  @Post('send-report')
  @WorkspaceAuth(Permission.TELEGRAM_SEND)
  async sendReport(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(SendTelegramReportBody) dto: SendTelegramReportBody,
  ) {
    return this.telegramService.sendReport(user, dto, workspaceId);
  }
}
