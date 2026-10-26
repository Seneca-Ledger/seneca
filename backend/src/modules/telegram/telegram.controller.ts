import { Controller, Delete, Get, HttpCode, Post } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import {
  SendTelegramReportBody,
  TelegramConnection,
  TelegramLink,
  TelegramReportPage,
  TelegramReportSent,
  TelegramReportsQuery,
} from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TelegramService } from './telegram.service';
import { TelegramBotsService } from './telegram-bots.service';

@Controller('telegram')
export class TelegramController {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly telegramBots: TelegramBotsService,
  ) {}

  /** A t.me link that connects the user's chat when they press Start in Telegram. */
  @Post('link')
  @WorkspaceAuth(Permission.TELEGRAM_CONNECT)
  @SchemaResponse(TelegramLink)
  async createLink(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    return this.telegramBots.createLink(user, workspaceId);
  }

  @Get('connection')
  @WorkspaceAuth(Permission.TELEGRAM_VIEW)
  @SchemaResponse(TelegramConnection)
  getConnection(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    return this.telegramService.getConnection(user, workspaceId);
  }

  @Delete('connection')
  @WorkspaceAuth(Permission.TELEGRAM_CONNECT)
  @HttpCode(204)
  async disconnect(@CurrentUser() user: User) {
    await this.telegramService.disconnect(user);
  }

  @Get('reports')
  @WorkspaceAuth(Permission.TELEGRAM_VIEW)
  @SchemaResponse(TelegramReportPage)
  async listReports(
    @CurrentUser() user: User,
    @SchemaQuery(TelegramReportsQuery) { page, limit }: TelegramReportsQuery,
  ) {
    return this.telegramService.listReports(user, page ?? 1, limit ?? 20);
  }

  @Post('send-report')
  @WorkspaceAuth(Permission.TELEGRAM_SEND)
  @SchemaResponse(TelegramReportSent)
  async sendReport(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(SendTelegramReportBody) dto: SendTelegramReportBody,
  ) {
    return this.telegramService.sendReport(user, dto, workspaceId);
  }
}
