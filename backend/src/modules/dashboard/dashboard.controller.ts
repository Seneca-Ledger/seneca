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
import { appError } from '../../common/errors/app-error';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import {
  CashFlowEntriesQuery,
  CashFlowQuery,
  DashboardCashFlowEntriesResponse,
  DashboardCommitmentsResponse,
  DashboardMonthlyCashFlowResponse,
  DashboardResponse,
  DashboardTrendsResponse,
} from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';
import { parseMonthWindow } from './dashboard-window.util';

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

  @Get('cash-flow/entries')
  @SchemaResponse(DashboardCashFlowEntriesResponse)
  async getCashFlowEntries(
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() viewerMemberId: string | null,
    @SchemaQuery(CashFlowEntriesQuery) query: CashFlowEntriesQuery,
  ) {
    return this.dashboardService.getCashFlowEntries(workspaceId, query.month, viewerMemberId);
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
      throw new BadRequestException(appError('DASHBOARD_MONTH_INVALID'));
    }
    return this.dashboardService.getTrends(workspaceId, days, month, selfMemberId ?? null);
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
