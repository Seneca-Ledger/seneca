import { Controller, Delete, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams, SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import {
  CreateInvestmentAccountBody,
  InvestmentAccount,
  InvestmentAccountList,
  InvestmentContribution,
  InvestmentContributionParams,
  InvestmentHolding,
  InvestmentParams,
  InvestmentReturnsQuery,
  LinkContributionBody,
  PriceRefreshResult,
  ReturnsResponse,
  UpsertHoldingBody,
} from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InvestmentFlowsService } from './investment-flows.service';
import { InvestmentReturnsService } from './investment-returns.service';
import { InvestmentsService } from './investments.service';

/**
 * Reading the investment accounts is a report; changing it changes what the workspace owns, so the
 * writes take the wallet permissions, like crypto holdings (owner and admins).
 */
@Controller('investments')
export class InvestmentsController {
  constructor(
    private readonly investmentsService: InvestmentsService,
    private readonly flowsService: InvestmentFlowsService,
    private readonly returnsService: InvestmentReturnsService,
  ) {}

  @Get()
  @WorkspaceAuth(Permission.REPORT_VIEW)
  @SchemaResponse(InvestmentAccountList)
  async list(@WorkspaceId() workspaceId: string) {
    return this.investmentsService.listAccounts(workspaceId);
  }

  @Get('returns')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  @SchemaResponse(ReturnsResponse)
  async returns(
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(InvestmentReturnsQuery) query: InvestmentReturnsQuery,
  ) {
    return this.returnsService.getReturns(workspaceId, query.range ?? '1y');
  }

  @Post('accounts')
  @WorkspaceAuth(Permission.WALLET_CREATE)
  @SchemaResponse(InvestmentAccount)
  async createAccount(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(CreateInvestmentAccountBody) dto: CreateInvestmentAccountBody,
  ) {
    return this.investmentsService.createAccount(user.id, workspaceId, dto);
  }

  @Delete('accounts/:id')
  @HttpCode(204)
  @WorkspaceAuth(Permission.WALLET_DELETE)
  async deleteAccount(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(InvestmentParams) { id }: InvestmentParams,
  ) {
    await this.investmentsService.deleteAccount(user.id, workspaceId, id);
  }

  @Post('accounts/:id/holdings')
  @WorkspaceAuth(Permission.WALLET_CREATE)
  @SchemaResponse(InvestmentHolding)
  async addHolding(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(InvestmentParams) { id }: InvestmentParams,
    @SchemaBody(UpsertHoldingBody) dto: UpsertHoldingBody,
  ) {
    return this.investmentsService.addHolding(user.id, workspaceId, id, dto);
  }

  @Patch('holdings/:id')
  @WorkspaceAuth(Permission.WALLET_EDIT)
  @SchemaResponse(InvestmentHolding)
  async updateHolding(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(InvestmentParams) { id }: InvestmentParams,
    @SchemaBody(UpsertHoldingBody) dto: UpsertHoldingBody,
  ) {
    return this.investmentsService.updateHolding(user.id, workspaceId, id, dto);
  }

  @Delete('holdings/:id')
  @HttpCode(204)
  @WorkspaceAuth(Permission.WALLET_DELETE)
  async deleteHolding(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(InvestmentParams) { id }: InvestmentParams,
  ) {
    await this.investmentsService.deleteHolding(user.id, workspaceId, id);
  }

  /** Fetches today's prices for every holding with a symbol. */
  @Post('refresh-prices')
  @HttpCode(200)
  @WorkspaceAuth(Permission.WALLET_EDIT)
  @SchemaResponse(PriceRefreshResult)
  async refreshPrices(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    const updated = await this.investmentsService.refreshPrices(user.id, workspaceId);
    return { updated };
  }

  /** Marks an expense as money moved into an investment account (a one-leg transfer). */
  @Post('contributions')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @SchemaResponse(InvestmentContribution)
  async linkContribution(
    @WorkspaceId() workspaceId: string,
    @SchemaBody(LinkContributionBody) dto: LinkContributionBody,
  ) {
    return this.flowsService.linkContribution(
      workspaceId,
      dto.transactionId,
      dto.accountId,
      dto.role ?? undefined,
    );
  }

  @Delete('contributions/:transactionId')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @SchemaResponse(InvestmentContribution)
  async unlinkContribution(
    @WorkspaceId() workspaceId: string,
    @SchemaParams(InvestmentContributionParams) { transactionId }: InvestmentContributionParams,
  ) {
    return this.flowsService.unlinkContribution(workspaceId, transactionId);
  }
}
