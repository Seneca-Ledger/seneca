import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import {
  AssignSubscriptionOwnerBody,
  ChargeCalendarQuery,
  CreateSubscriptionBody,
  LinkSubscriptionChargeBody,
  RecordSubscriptionChargeBody,
  RecordSubscriptionDecisionBody,
  SubscriptionChargeCalendar,
  SubscriptionChargeCandidates,
  SubscriptionChargeCandidatesQuery,
  SubscriptionChargeRow,
  SubscriptionDetail,
  SubscriptionDuplicateGroups,
  SubscriptionList,
  SubscriptionMonthStatus,
  SubscriptionSummary,
  UpdateSubscriptionBody,
} from '../../contracts';
import { SubscriptionStatus } from '../../entities/subscription.entity';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  @WorkspaceAuth(Permission.SUBSCRIPTION_VIEW)
  @SchemaResponse(SubscriptionList)
  async findAll(@WorkspaceId() workspaceId: string, @Query('status') status?: SubscriptionStatus) {
    return this.subscriptionsService.findAll(workspaceId, status);
  }

  @Get('summary')
  @WorkspaceAuth(Permission.SUBSCRIPTION_VIEW)
  @SchemaResponse(SubscriptionSummary)
  async getSummary(@WorkspaceId() workspaceId: string) {
    return this.subscriptionsService.getSummary(workspaceId);
  }

  @Get('charge-calendar')
  @WorkspaceAuth(Permission.SUBSCRIPTION_VIEW)
  @SchemaResponse(SubscriptionChargeCalendar)
  async getChargeCalendar(
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(ChargeCalendarQuery) query: ChargeCalendarQuery,
  ) {
    return this.subscriptionsService.getChargeCalendar(workspaceId, query.months);
  }

  @Get('month-status')
  @WorkspaceAuth(Permission.SUBSCRIPTION_VIEW)
  @SchemaResponse(SubscriptionMonthStatus)
  async getMonthStatus(@WorkspaceId() workspaceId: string) {
    return this.subscriptionsService.getMonthStatus(workspaceId);
  }

  @Get('charge-candidates')
  @WorkspaceAuth(Permission.SUBSCRIPTION_VIEW)
  @SchemaResponse(SubscriptionChargeCandidates)
  async getChargeCandidates(
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
    @SchemaQuery(SubscriptionChargeCandidatesQuery) query: SubscriptionChargeCandidatesQuery,
  ) {
    return this.subscriptionsService.getChargeCandidates(workspaceId, query, selfMemberId);
  }

  @Get('upcoming')
  @WorkspaceAuth(Permission.SUBSCRIPTION_VIEW)
  async getUpcoming(@WorkspaceId() workspaceId: string, @Query('days') days?: string) {
    return this.subscriptionsService.getUpcoming(workspaceId, days ? Number.parseInt(days, 10) : 7);
  }

  /** Active subscriptions with owner and monthly cost; `format=csv` for a spreadsheet. */
  @Get('business-report')
  @WorkspaceAuth(Permission.SUBSCRIPTION_VIEW)
  async businessReport(
    @WorkspaceId() workspaceId: string,
    @Query('format') format: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const report = await this.subscriptionsService.getBusinessReport(workspaceId);
    if (format !== 'csv') {
      return report;
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="business-subscriptions.csv"');
    const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const header = [
      'vendor',
      'owner',
      `monthly_cost_${report.currency}`,
      'amount',
      'currency',
      'frequency',
      'next_charge',
      'review_at',
      'risk',
    ].join(',');
    const lines = report.rows.map(row =>
      [
        cell(row.vendorName),
        cell(row.owner),
        row.monthlyCost.toFixed(2),
        row.amount.toFixed(2),
        cell(row.subscriptionCurrency),
        cell(row.frequency),
        cell(row.nextChargeDate ? String(row.nextChargeDate).slice(0, 10) : ''),
        cell(row.reviewAt ? String(row.reviewAt).slice(0, 10) : ''),
        cell(row.riskStatus),
      ].join(','),
    );
    return `${[header, ...lines].join('\n')}\n`;
  }

  @Get('duplicates')
  @WorkspaceAuth(Permission.SUBSCRIPTION_VIEW)
  @SchemaResponse(SubscriptionDuplicateGroups)
  async duplicates(@WorkspaceId() workspaceId: string) {
    return this.subscriptionsService.getDuplicates(workspaceId);
  }

  @Get('sinking-funds')
  @WorkspaceAuth(Permission.SUBSCRIPTION_VIEW)
  async sinkingFunds(@WorkspaceId() workspaceId: string) {
    return this.subscriptionsService.getSinkingFunds(workspaceId);
  }

  @Post(':id/usage')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.SUBSCRIPTION_EDIT)
  async recordUsage(@Param('id') id: string, @WorkspaceId() workspaceId: string) {
    return this.subscriptionsService.recordUsage(id, workspaceId);
  }

  @Post(':id/sinking-fund')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.SUBSCRIPTION_EDIT)
  async createSinkingFund(
    @Param('id') id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    return this.subscriptionsService.createSinkingFund(id, workspaceId, user.id);
  }

  @Post(':id/charges')
  @WorkspaceAuth(Permission.SUBSCRIPTION_EDIT)
  @SchemaResponse(SubscriptionChargeRow)
  async recordCharge(
    @Param('id') id: string,
    @SchemaBody(RecordSubscriptionChargeBody) dto: RecordSubscriptionChargeBody,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    return this.subscriptionsService.recordCharge(id, workspaceId, user.id, dto);
  }

  @Patch(':id/charges/:chargeId')
  @WorkspaceAuth(Permission.SUBSCRIPTION_EDIT)
  @SchemaResponse(SubscriptionChargeRow)
  async linkCharge(
    @Param('id') id: string,
    @Param('chargeId') chargeId: string,
    @SchemaBody(LinkSubscriptionChargeBody) dto: LinkSubscriptionChargeBody,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    return this.subscriptionsService.linkCharge(id, chargeId, workspaceId, user.id, dto);
  }

  @Delete(':id/charges/:chargeId')
  @WorkspaceAuth(Permission.SUBSCRIPTION_EDIT)
  async removeCharge(
    @Param('id') id: string,
    @Param('chargeId') chargeId: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    await this.subscriptionsService.removeCharge(id, chargeId, workspaceId, user.id);
  }

  @Get(':id')
  @WorkspaceAuth(Permission.SUBSCRIPTION_VIEW)
  @SchemaResponse(SubscriptionDetail)
  async findOne(@Param('id') id: string, @WorkspaceId() workspaceId: string) {
    return this.subscriptionsService.getDetails(id, workspaceId);
  }

  @Post()
  @WorkspaceAuth(Permission.SUBSCRIPTION_CREATE)
  async create(
    @SchemaBody(CreateSubscriptionBody) dto: CreateSubscriptionBody,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    return this.subscriptionsService.create(workspaceId, user.id, dto);
  }

  @Put(':id')
  @WorkspaceAuth(Permission.SUBSCRIPTION_EDIT)
  async update(
    @Param('id') id: string,
    @SchemaBody(UpdateSubscriptionBody) dto: UpdateSubscriptionBody,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    return this.subscriptionsService.update(id, workspaceId, user.id, dto);
  }

  @Patch(':id/owner')
  @WorkspaceAuth(Permission.SUBSCRIPTION_EDIT)
  async assignOwner(
    @Param('id') id: string,
    @SchemaBody(AssignSubscriptionOwnerBody) dto: AssignSubscriptionOwnerBody,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    return this.subscriptionsService.assignOwner(id, workspaceId, dto.ownerId, user.id);
  }

  @Post(':id/decisions')
  @WorkspaceAuth(Permission.SUBSCRIPTION_EDIT)
  async recordDecision(
    @Param('id') id: string,
    @SchemaBody(RecordSubscriptionDecisionBody) dto: RecordSubscriptionDecisionBody,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    return this.subscriptionsService.recordDecision(id, workspaceId, user.id, dto);
  }

  @Post(':id/confirm')
  @WorkspaceAuth(Permission.SUBSCRIPTION_EDIT)
  async confirm(
    @Param('id') id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    return this.subscriptionsService.confirm(id, workspaceId, user.id);
  }

  @Post(':id/dismiss')
  @WorkspaceAuth(Permission.SUBSCRIPTION_EDIT)
  async dismiss(
    @Param('id') id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    await this.subscriptionsService.dismiss(id, workspaceId, user.id);
  }

  @Delete(':id')
  @WorkspaceAuth(Permission.SUBSCRIPTION_DELETE)
  async remove(
    @Param('id') id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    await this.subscriptionsService.remove(id, workspaceId, user.id);
  }
}
