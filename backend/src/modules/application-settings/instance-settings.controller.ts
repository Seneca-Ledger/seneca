import { Controller, Delete, Get, Put, UseGuards } from '@nestjs/common';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaResponse } from '../../common/effect/schema-response';
import { InstanceAdminGuard } from '../../common/guards/instance-admin.guard';
import { InstanceTelegramBotStatus, SaveInstanceTelegramBotBody } from '../../contracts';
import type { User } from '../../entities';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApplicationSettingsService } from './application-settings.service';

/** Settings of the whole server, not of a workspace: only instance administrators. */
@Controller('settings/instance')
@UseGuards(InstanceAdminGuard)
export class InstanceSettingsController {
  constructor(private readonly applicationSettingsService: ApplicationSettingsService) {}

  @Get('telegram')
  @SchemaResponse(InstanceTelegramBotStatus)
  getTelegram() {
    return this.applicationSettingsService.getInstanceTelegramStatus();
  }

  @Put('telegram')
  @SchemaResponse(InstanceTelegramBotStatus)
  saveTelegram(
    @CurrentUser() user: User,
    @SchemaBody(SaveInstanceTelegramBotBody) body: SaveInstanceTelegramBotBody,
  ) {
    return this.applicationSettingsService.saveInstanceTelegramSettings(user, body);
  }

  @Delete('telegram')
  @SchemaResponse(InstanceTelegramBotStatus)
  clearTelegram() {
    return this.applicationSettingsService.clearInstanceTelegramSettings();
  }
}
