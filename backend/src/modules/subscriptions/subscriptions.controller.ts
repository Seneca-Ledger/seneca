import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Put,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams, SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { toEnum } from '../../common/effect/to-enum';
import { Permission } from '../../common/enums/permissions.enum';
import { neutralizeSpreadsheetFormulaCell } from '../../common/utils/spreadsheet-formula.util';
import {
  AssignSubscriptionOwnerBody,
  ChargeCalendarQuery,
  CreateSubscriptionBody,
  LinkSubscriptionChargeBody,
  RecordSubscriptionChargeBody,
  RecordSubscriptionDecisionBody,
  SinkingFundList,
  SinkingFundResult,
  SubscriptionBusinessReportQuery,
  SubscriptionChargeCalendar,
  SubscriptionChargeCandidates,
  SubscriptionChargeCandidatesQuery,
  SubscriptionChargeParams,
  SubscriptionChargeRow,
  SubscriptionDetail,
  SubscriptionDuplicateGroups,
  SubscriptionItem,
  SubscriptionList,
  SubscriptionMonthStatus,
  SubscriptionParams,
  SubscriptionRecord,
  SubscriptionSummary,
  SubscriptionsQuery,
  UpcomingSubscriptionList,
  UpcomingSubscriptionsQuery,
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
  async findAll(
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(SubscriptionsQuery) query: SubscriptionsQuery,
  ) {
    return this.subscriptionsService.findAll(workspaceId, toEnum(SubscriptionStatus, query.status));
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
  @SchemaResponse(UpcomingSubscriptionList)
  async getUpcoming(
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(UpcomingSubscriptionsQuery) query: UpcomingSubscriptionsQuery,
  ) {
    return this.subscriptionsService.getUpcoming(workspaceId, query.days ?? 7);
  }

  /** Active subscriptions with owner and monthly cost; `format=csv` for a spreadsheet. */
  @Get('business-report')
  @WorkspaceAuth(Permission.SUBSCRIPTION_VIEW)
  async businessReport(
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(SubscriptionBusinessReportQuery) query: SubscriptionBusinessReportQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    const report = await this.subscriptionsService.getBusinessReport(workspaceId);
    if (query.format !== 'csv') {
      return report;
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="business-subscriptions.csv"');
    // Vendor and owner names are user text: a leading = + - @ must not run as a formula.
    const cell = (value: unknown) =>
      `"${String(neutralizeSpreadsheetFormulaCell(value ?? '')).replace(/"/g, '""')}"`;
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
  @SchemaResponse(SinkingFundList)
  async sinkingFunds(@WorkspaceId() workspaceId: string) {
    return this.subscriptionsService.getSinkingFunds(workspaceId);
  }

  @Post(':id/usage')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.SUBSCRIPTION_EDIT)
  @SchemaResponse(SubscriptionItem)
  async recordUsage(
    @SchemaParams(SubscriptionParams) { id }: SubscriptionParams,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.subscriptionsService.recordUsage(id, workspaceId);
  }

  @Post(':id/sinking-fund')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.SUBSCRIPTION_EDIT)
  @SchemaResponse(SinkingFundResult)
  async createSinkingFund(
    @SchemaParams(SubscriptionParams) { id }: SubscriptionParams,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    return this.subscriptionsService.createSinkingFund(id, workspaceId, user.id);
  }

  @Post(':id/charges')
  @WorkspaceAuth(Permission.SUBSCRIPTION_EDIT)
  @SchemaResponse(SubscriptionChargeRow)
  async recordCharge(
    @SchemaParams(SubscriptionParams) { id }: SubscriptionParams,
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
    @SchemaParams(SubscriptionChargeParams) { id, chargeId }: SubscriptionChargeParams,
    @SchemaBody(LinkSubscriptionChargeBody) dto: LinkSubscriptionChargeBody,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    return this.subscriptionsService.linkCharge(id, chargeId, workspaceId, user.id, dto);
  }

  @Delete(':id/charges/:chargeId')
  @WorkspaceAuth(Permission.SUBSCRIPTION_EDIT)
  async removeCharge(
    @SchemaParams(SubscriptionChargeParams) { id, chargeId }: SubscriptionChargeParams,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    await this.subscriptionsService.removeCharge(id, chargeId, workspaceId, user.id);
  }

  @Get(':id')
  @WorkspaceAuth(Permission.SUBSCRIPTION_VIEW)
  @SchemaResponse(SubscriptionDetail)
  async findOne(
    @SchemaParams(SubscriptionParams) { id }: SubscriptionParams,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.subscriptionsService.getDetails(id, workspaceId);
  }

  @Post()
  @WorkspaceAuth(Permission.SUBSCRIPTION_CREATE)
  @SchemaResponse(SubscriptionRecord)
  async create(
    @SchemaBody(CreateSubscriptionBody) dto: CreateSubscriptionBody,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    // Re-read: the saved entity holds the amount and dates as sent, not as stored.
    const saved = await this.subscriptionsService.create(workspaceId, user.id, dto);
    return this.subscriptionsService.findOne(saved.id, workspaceId);
  }

  @Put(':id')
  @WorkspaceAuth(Permission.SUBSCRIPTION_EDIT)
  @SchemaResponse(SubscriptionRecord)
  async update(
    @SchemaParams(SubscriptionParams) { id }: SubscriptionParams,
    @SchemaBody(UpdateSubscriptionBody) dto: UpdateSubscriptionBody,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    await this.subscriptionsService.update(id, workspaceId, user.id, dto);
    return this.subscriptionsService.findOne(id, workspaceId);
  }

  @Patch(':id/owner')
  @WorkspaceAuth(Permission.SUBSCRIPTION_EDIT)
  @SchemaResponse(SubscriptionRecord)
  async assignOwner(
    @SchemaParams(SubscriptionParams) { id }: SubscriptionParams,
    @SchemaBody(AssignSubscriptionOwnerBody) dto: AssignSubscriptionOwnerBody,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    return this.subscriptionsService.assignOwner(id, workspaceId, dto.ownerId, user.id);
  }

  @Post(':id/decisions')
  @WorkspaceAuth(Permission.SUBSCRIPTION_EDIT)
  @SchemaResponse(SubscriptionRecord)
  async recordDecision(
    @SchemaParams(SubscriptionParams) { id }: SubscriptionParams,
    @SchemaBody(RecordSubscriptionDecisionBody) dto: RecordSubscriptionDecisionBody,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    await this.subscriptionsService.recordDecision(id, workspaceId, user.id, dto);
    return this.subscriptionsService.findOne(id, workspaceId);
  }

  @Post(':id/confirm')
  @WorkspaceAuth(Permission.SUBSCRIPTION_EDIT)
  @SchemaResponse(SubscriptionRecord)
  async confirm(
    @SchemaParams(SubscriptionParams) { id }: SubscriptionParams,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    return this.subscriptionsService.confirm(id, workspaceId, user.id);
  }

  @Post(':id/dismiss')
  @WorkspaceAuth(Permission.SUBSCRIPTION_EDIT)
  async dismiss(
    @SchemaParams(SubscriptionParams) { id }: SubscriptionParams,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    await this.subscriptionsService.dismiss(id, workspaceId, user.id);
  }

  @Delete(':id')
  @WorkspaceAuth(Permission.SUBSCRIPTION_DELETE)
  async remove(
    @SchemaParams(SubscriptionParams) { id }: SubscriptionParams,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    await this.subscriptionsService.remove(id, workspaceId, user.id);
  }
}
