import { Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SchemaResponse } from '../../common/effect/schema-response';
import { InstanceAdminGuard } from '../../common/guards/instance-admin.guard';
import { SystemUpdateStatus } from '../../contracts';
import type { User } from '../../entities';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SystemUpdateService } from './system-update.service';

/** Instance-wide, not per workspace: only users with the `admin` role. */
@Controller('system/update')
@UseGuards(InstanceAdminGuard)
export class SystemUpdateController {
  constructor(private readonly systemUpdateService: SystemUpdateService) {}

  @Get()
  @ApiOperation({ summary: 'Running version, newest release and the last in-app update' })
  @ApiResponse({ status: 200, description: 'SystemUpdateStatus' })
  @SchemaResponse(SystemUpdateStatus)
  @ApiResponse({ status: 403, description: 'INSTANCE_ADMIN_ONLY' })
  getStatus(@CurrentUser() user: User) {
    return this.systemUpdateService.getStatus(user);
  }

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Ask the updater container to install the newest release' })
  @ApiResponse({ status: 202, description: 'SystemUpdateStatus with the queued run' })
  @SchemaResponse(SystemUpdateStatus)
  @ApiResponse({ status: 403, description: 'INSTANCE_ADMIN_ONLY' })
  @ApiResponse({
    status: 409,
    description:
      'SYSTEM_UPDATER_UNAVAILABLE, SYSTEM_UPDATE_IN_PROGRESS or SYSTEM_UPDATE_NOT_AVAILABLE',
  })
  requestUpdate(@CurrentUser() user: User) {
    return this.systemUpdateService.requestUpdate(user);
  }
}
