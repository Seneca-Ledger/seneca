import { Controller, Get } from '@nestjs/common';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { ForecastQuery, ForecastResponse } from '../../contracts';
import { ForecastService } from './forecast.service';

@Controller('forecast')
export class ForecastController {
  constructor(private readonly forecastService: ForecastService) {}

  /** Projected balance for 30/90/365 days with safe-to-spend, shortfall date, runway and scenarios. */
  @Get()
  @WorkspaceAuth(Permission.REPORT_VIEW)
  @SchemaResponse(ForecastResponse)
  async getForecast(
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
    @SchemaQuery(ForecastQuery) query: ForecastQuery,
  ) {
    return this.forecastService.getForecast(workspaceId, query, selfMemberId);
  }
}
