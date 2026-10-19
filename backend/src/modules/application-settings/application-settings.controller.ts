import {
  Controller,
  Delete,
  Get,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import {
  LocalCategorizationStatus,
  SaveAppSettingsBody,
  SaveLocalCategorizationBody,
  SaveSmtpSettingsBody,
  SaveTelegramSettingsBody,
  TelegramBotStatus,
  TestLocalCategorizationBody,
} from '../../contracts';
import { User, WorkspaceServiceSettingsKey } from '../../entities';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApplicationSettingsService } from './application-settings.service';

type UploadedModelArchive = {
  originalname?: string;
  buffer?: Buffer;
};

@Controller('settings')
export class ApplicationSettingsController {
  constructor(private readonly applicationSettingsService: ApplicationSettingsService) {}

  @Get('local-categorization')
  @UseGuards(WorkspaceContextGuard)
  @SchemaResponse(LocalCategorizationStatus)
  getLocalCategorization(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    return this.applicationSettingsService.getLocalCategorizationStatus(user, workspaceId);
  }

  @Put('local-categorization')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  saveLocalCategorization(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(SaveLocalCategorizationBody) body: SaveLocalCategorizationBody,
  ) {
    return this.applicationSettingsService.saveLocalCategorizationSettings(user, body, workspaceId);
  }

  @Post('local-categorization/test')
  @UseGuards(WorkspaceContextGuard)
  testLocalCategorization(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(TestLocalCategorizationBody) body: TestLocalCategorizationBody,
  ) {
    return this.applicationSettingsService.testLocalCategorization(user, body, workspaceId);
  }

  @Post('local-categorization/model')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  @UseInterceptors(
    FileInterceptor('model', {
      storage: memoryStorage(),
      limits: { fileSize: 500 * 1024 * 1024 },
    }),
  )
  uploadLocalCategorizationModel(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @UploadedFile() file: UploadedModelArchive | undefined,
  ) {
    return this.applicationSettingsService.installLocalCategorizationModel(user, file, workspaceId);
  }

  @Get('email/smtp')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  getSmtp(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    return this.applicationSettingsService.getSmtpStatus(user, workspaceId);
  }

  @Put('email/smtp')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  saveSmtp(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(SaveSmtpSettingsBody) body: SaveSmtpSettingsBody,
  ) {
    return this.applicationSettingsService.saveSmtpSettings(user, body, workspaceId);
  }

  @Delete('email/smtp')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
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
  saveTelegram(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(SaveTelegramSettingsBody) body: SaveTelegramSettingsBody,
  ) {
    return this.applicationSettingsService.saveTelegramSettings(user, body, workspaceId);
  }

  @Delete('notifications/telegram')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  disconnectTelegram(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    return this.applicationSettingsService.disconnect(
      user,
      WorkspaceServiceSettingsKey.TELEGRAM,
      workspaceId,
    );
  }

  @Get('app')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  getApp(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    return this.applicationSettingsService.getAppStatus(user, workspaceId);
  }

  @Put('app')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  saveApp(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(SaveAppSettingsBody) body: SaveAppSettingsBody,
  ) {
    return this.applicationSettingsService.saveAppSettings(user, body, workspaceId);
  }

  @Delete('app')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  disconnectApp(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    return this.applicationSettingsService.disconnect(
      user,
      WorkspaceServiceSettingsKey.APP,
      workspaceId,
    );
  }
}
