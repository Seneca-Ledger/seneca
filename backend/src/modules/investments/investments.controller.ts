import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { Permission } from '../../common/enums/permissions.enum';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateInvestmentAccountDto } from './dto/create-investment-account.dto';
import { LinkContributionDto } from './dto/link-contribution.dto';
import { ReturnsQueryDto } from './dto/returns-query.dto';
import { UpsertHoldingDto } from './dto/upsert-holding.dto';
import { InvestmentReturnsService } from './investment-returns.service';
import { InvestmentsService } from './investments.service';

@Controller('investments')
export class InvestmentsController {
  constructor(
    private readonly investmentsService: InvestmentsService,
    private readonly returnsService: InvestmentReturnsService,
  ) {}

  @Get()
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async list(@WorkspaceId() workspaceId: string) {
    return this.investmentsService.listAccounts(workspaceId);
  }

  @Get('returns')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async returns(@WorkspaceId() workspaceId: string, @Query() query: ReturnsQueryDto) {
    return this.returnsService.getReturns(workspaceId, query.range ?? '1y');
  }

  @Post('accounts')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async createAccount(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateInvestmentAccountDto,
  ) {
    return this.investmentsService.createAccount(user.id, workspaceId, dto);
  }

  @Delete('accounts/:id')
  @HttpCode(204)
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async deleteAccount(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
  ) {
    await this.investmentsService.deleteAccount(user.id, workspaceId, id);
  }

  @Post('accounts/:id/holdings')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async addHolding(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpsertHoldingDto,
  ) {
    return this.investmentsService.addHolding(user.id, workspaceId, id, dto);
  }

  @Patch('holdings/:id')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async updateHolding(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpsertHoldingDto,
  ) {
    return this.investmentsService.updateHolding(user.id, workspaceId, id, dto);
  }

  @Delete('holdings/:id')
  @HttpCode(204)
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async deleteHolding(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
  ) {
    await this.investmentsService.deleteHolding(user.id, workspaceId, id);
  }

  /** Fetches today's prices for every holding with a symbol. */
  @Post('refresh-prices')
  @HttpCode(200)
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async refreshPrices(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    const updated = await this.investmentsService.refreshPrices(user.id, workspaceId);
    return { updated };
  }

  /** Marks an expense as money moved into an investment account (a one-leg transfer). */
  @Post('contributions')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  async linkContribution(@WorkspaceId() workspaceId: string, @Body() dto: LinkContributionDto) {
    return this.investmentsService.linkContribution(workspaceId, dto.transactionId, dto.accountId);
  }

  @Delete('contributions/:transactionId')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  async unlinkContribution(
    @WorkspaceId() workspaceId: string,
    @Param('transactionId') transactionId: string,
  ) {
    return this.investmentsService.unlinkContribution(workspaceId, transactionId);
  }
}
