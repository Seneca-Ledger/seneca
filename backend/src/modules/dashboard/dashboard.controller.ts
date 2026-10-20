import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import {
  CashFlowQuery,
  DashboardCommitmentsResponse,
  DashboardHealthHistoryResponse,
  DashboardMonthlyCashFlowResponse,
  DashboardResponse,
  DashboardTrendsResponse,
} from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';
import { parseMonthWindow } from './dashboard-window.util';

const MIN_HISTORY_YEAR = 1970;
const MAX_HISTORY_YEAR = 9999;

@Controller('dashboard')
@UseGuards(JwtAuthGuard, WorkspaceContextGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @SchemaResponse(DashboardResponse)
  async getDashboard(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Query('range') range: '7d' | '30d' | '90d' | 'month' = '30d',
    @Query('date') date?: string,
    @WorkspaceMemberId() selfMemberId?: string | null,
  ) {
    const validRange: '7d' | '30d' | '90d' | 'month' = ['7d', '30d', '90d', 'month'].includes(range)
      ? range
      : '30d';
    return this.dashboardService.getDashboard(
      user.id,
      workspaceId,
      validRange,
      date,
      selfMemberId ?? null,
    );
  }

  @Get('cash-flow')
  @SchemaResponse(DashboardMonthlyCashFlowResponse)
  async getCashFlow(
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(CashFlowQuery) query: CashFlowQuery,
  ) {
    return this.dashboardService.getMonthlyCashFlow(workspaceId, query.range ?? '12m', query.month);
  }

  @Get('trends')
  @SchemaResponse(DashboardTrendsResponse)
  async getTrends(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Query('month') month?: string,
    @WorkspaceMemberId() selfMemberId?: string | null,
  ) {
    if (month !== undefined && !parseMonthWindow(month)) {
      throw new BadRequestException('month must be YYYY-MM');
    }
    return this.dashboardService.getTrends(workspaceId, days, month, selfMemberId ?? null);
  }

  @Get('health-history')
  @SchemaResponse(DashboardHealthHistoryResponse)
  async getHealthHistory(
    @WorkspaceId() workspaceId: string,
    @Query('year', new ParseIntPipe({ optional: true })) year?: number,
  ) {
    const resolvedYear = year ?? new Date().getFullYear();
    if (resolvedYear < MIN_HISTORY_YEAR || resolvedYear > MAX_HISTORY_YEAR) {
      throw new BadRequestException('year is out of range');
    }
    return this.dashboardService.getHealthHistory(workspaceId, resolvedYear);
  }

  @Get('commitments')
  @SchemaResponse(DashboardCommitmentsResponse)
  async getCommitments(
    @WorkspaceId() workspaceId: string,
    @Query('days', new DefaultValuePipe(60), ParseIntPipe) days: number,
  ) {
    return this.dashboardService.getCommitments(workspaceId, days);
  }
}
