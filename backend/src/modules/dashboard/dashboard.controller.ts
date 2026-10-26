import { Controller, Get, UseGuards } from '@nestjs/common';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
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
import {
  DashboardCommitmentsQuery,
  DashboardQuery,
  DashboardTrendsQuery,
} from '../../contracts/requests/dashboard';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, WorkspaceContextGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @SchemaResponse(DashboardResponse)
  async getDashboard(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(DashboardQuery) query: DashboardQuery,
    @WorkspaceMemberId() selfMemberId?: string | null,
  ) {
    return this.dashboardService.getDashboard(
      user.id,
      workspaceId,
      query.range ?? '30d',
      query.date,
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
    @SchemaQuery(DashboardTrendsQuery) { days = 30, month }: DashboardTrendsQuery,
    @WorkspaceMemberId() selfMemberId?: string | null,
  ) {
    return this.dashboardService.getTrends(workspaceId, days, month, selfMemberId ?? null);
  }

  @Get('commitments')
  @SchemaResponse(DashboardCommitmentsResponse)
  async getCommitments(
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(DashboardCommitmentsQuery) query: DashboardCommitmentsQuery,
  ) {
    return this.dashboardService.getCommitments(workspaceId, query.days ?? 60);
  }
}
