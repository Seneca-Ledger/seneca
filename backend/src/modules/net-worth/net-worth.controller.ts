import { Controller, Get } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { toEnum } from '../../common/effect/to-enum';
import { Permission } from '../../common/enums/permissions.enum';
import { NetWorthQuery, NetWorthResponse } from '../../contracts';
import { InvestmentMetal } from '../../entities/investment-holding.entity';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NetWorthService } from './net-worth.service';

@Controller('reports/net-worth')
export class NetWorthController {
  constructor(private readonly netWorthService: NetWorthService) {}

  @Get()
  @WorkspaceAuth(Permission.REPORT_VIEW)
  @SchemaResponse(NetWorthResponse)
  async getNetWorth(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(NetWorthQuery) query: NetWorthQuery,
  ) {
    return this.netWorthService.getNetWorth(
      workspaceId,
      query,
      user.locale,
      toEnum(InvestmentMetal, query.denominate),
    );
  }
}
