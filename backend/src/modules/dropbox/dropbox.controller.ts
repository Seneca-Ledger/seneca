import { Body, Controller, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { Permission } from '../../common/enums/permissions.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { DropboxService } from './dropbox.service';
import { ImportDropboxFilesDto } from './dto/import-dropbox-files.dto';
import { UpdateDropboxSettingsDto } from './dto/update-dropbox-settings.dto';

@Controller('integrations/dropbox')
@UseGuards(JwtAuthGuard)
export class DropboxController {
  constructor(private readonly dropboxService: DropboxService) {}

  @Get('status')
  @UseGuards(WorkspaceContextGuard)
  async status(@WorkspaceId() workspaceId: string) {
    return this.dropboxService.getStatus(workspaceId);
  }

  @Get('connect')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  async connect(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    const url = this.dropboxService.getAuthUrl(user, workspaceId);
    return { url };
  }

  @Public()
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const redirect = await this.dropboxService.handleOAuthCallback({
      code,
      state,
      error,
    });
    return res.redirect(redirect);
  }

  @Post('disconnect')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  async disconnect(@WorkspaceId() workspaceId: string) {
    return this.dropboxService.disconnect(workspaceId);
  }

  @Post('settings')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  async updateSettings(@WorkspaceId() workspaceId: string, @Body() dto: UpdateDropboxSettingsDto) {
    return this.dropboxService.updateSettings(workspaceId, dto);
  }

  @Get('picker-token')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  async getPickerToken(@WorkspaceId() workspaceId: string) {
    return this.dropboxService.getPickerToken(workspaceId);
  }

  @Post('import')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  async importFiles(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Body() dto: ImportDropboxFilesDto,
  ) {
    return this.dropboxService.importFiles(user.id, workspaceId, dto);
  }

  @Post('sync')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  async sync(@WorkspaceId() workspaceId: string) {
    return this.dropboxService.syncNow(workspaceId);
  }
}
