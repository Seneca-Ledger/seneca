import { Controller, Get, Query } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { Permission } from '../../common/enums/permissions.enum';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NetWorthQueryDto } from './dto/net-worth-query.dto';
import { NetWorthService } from './net-worth.service';

@Controller('reports/net-worth')
export class NetWorthController {
  constructor(private readonly netWorthService: NetWorthService) {}

  @Get()
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async getNetWorth(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Query() query: NetWorthQueryDto,
  ) {
    return this.netWorthService.getNetWorth(workspaceId, query, user.locale);
  }
}
