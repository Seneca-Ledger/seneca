import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { MarkReadBody, UpdateNotificationPreferencesBody } from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, WorkspaceContextGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.notificationsService.findByRecipient(
      user.id,
      workspaceId,
      limit ? Number(limit) : 30,
      offset ? Number(offset) : 0,
    );
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    const count = await this.notificationsService.getUnreadCount(user.id, workspaceId);
    return { count };
  }

  @Post('mark-read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(@CurrentUser() user: User, @SchemaBody(MarkReadBody) dto: MarkReadBody) {
    const updated = await this.notificationsService.markAsRead(user.id, dto.ids);
    return { updated };
  }

  @Post('mark-all-read')
  @HttpCode(HttpStatus.OK)
  async markAllAsRead(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    const updated = await this.notificationsService.markAllAsRead(user.id, workspaceId);
    return { updated };
  }

  @Get('preferences')
  async getPreferences(@CurrentUser() user: User) {
    return this.notificationsService.getPreferences(user.id);
  }

  @Patch('preferences')
  async updatePreferences(
    @CurrentUser() user: User,
    @SchemaBody(UpdateNotificationPreferencesBody) dto: UpdateNotificationPreferencesBody,
  ) {
    return this.notificationsService.updatePreferences(user.id, dto);
  }
}
