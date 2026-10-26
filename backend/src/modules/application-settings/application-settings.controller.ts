import { Controller, Delete, Get, Put, UseGuards } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import {
  IntegrationConnection,
  IntegrationDisconnected,
  SaveAppSettingsBody,
  SaveSmtpSettingsBody,
  SaveTelegramSettingsBody,
  TelegramBotStatus,
} from '../../contracts';
import { User, WorkspaceServiceSettingsKey } from '../../entities';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApplicationSettingsService } from './application-settings.service';

@Controller('settings')
export class ApplicationSettingsController {
  constructor(private readonly applicationSettingsService: ApplicationSettingsService) {}

  @Get('email/smtp')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  @SchemaResponse(IntegrationConnection)
  getSmtp(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    return this.applicationSettingsService.getSmtpStatus(user, workspaceId);
  }

  @Put('email/smtp')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  @SchemaResponse(IntegrationConnection)
  saveSmtp(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(SaveSmtpSettingsBody) body: SaveSmtpSettingsBody,
  ) {
    return this.applicationSettingsService.saveSmtpSettings(user, body, workspaceId);
  }

  @Delete('email/smtp')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  @SchemaResponse(IntegrationDisconnected)
  disconnectSmtp(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    return this.applicationSettingsService.disconnect(
      user,
      WorkspaceServiceSettingsKey.SMTP,
      workspaceId,
    );
  }

  @Get('notifications/telegram')
  @UseGuards(WorkspaceContextGuard)
  @SchemaResponse(TelegramBotStatus)
  getTelegram(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    return this.applicationSettingsService.getTelegramStatus(user, workspaceId);
  }

  @Put('notifications/telegram')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  @SchemaResponse(TelegramBotStatus)
  saveTelegram(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(SaveTelegramSettingsBody) body: SaveTelegramSettingsBody,
  ) {
    return this.applicationSettingsService.saveTelegramSettings(user, body, workspaceId);
  }

  @Delete('notifications/telegram')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  @SchemaResponse(IntegrationDisconnected)
  disconnectTelegram(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    return this.applicationSettingsService.disconnect(
      user,
      WorkspaceServiceSettingsKey.TELEGRAM,
      workspaceId,
    );
  }

  @Get('app')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  @SchemaResponse(IntegrationConnection)
  getApp(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    return this.applicationSettingsService.getAppStatus(user, workspaceId);
  }

  @Put('app')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  @SchemaResponse(IntegrationConnection)
  saveApp(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(SaveAppSettingsBody) body: SaveAppSettingsBody,
  ) {
    return this.applicationSettingsService.saveAppSettings(user, body, workspaceId);
  }

  @Delete('app')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  @SchemaResponse(IntegrationDisconnected)
  disconnectApp(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    return this.applicationSettingsService.disconnect(
      user,
      WorkspaceServiceSettingsKey.APP,
      workspaceId,
    );
  }
}
