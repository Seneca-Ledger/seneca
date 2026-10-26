import { Controller, Delete, Get, Post, Put } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { deletedResponse } from '../../common/utils/responses.util';
import {
  AccountStatementList,
  AttachStatementsBody,
  AttachStatementsResult,
  CreateWalletRequest,
  MessageResult,
  UpdateWalletBody,
  WalletItem,
  WalletList,
  WalletParams,
  WalletSeries,
  WalletStatementParams,
  WalletSummary,
} from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WalletsService } from './wallets.service';

@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Post()
  @WorkspaceAuth(Permission.WALLET_CREATE)
  @SchemaResponse(WalletItem)
  async create(
    @SchemaBody(CreateWalletRequest) createDto: CreateWalletRequest,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    const created = await this.walletsService.create(workspaceId, user.id, createDto);
    // The stored form, as the list reads it: defaults filled, decimals as strings.
    return this.walletsService.findOneWithBalance(created.id, workspaceId);
  }

  @Get()
  @WorkspaceAuth(Permission.WALLET_VIEW)
  @SchemaResponse(WalletList)
  async findAll(@CurrentUser() _user: User, @WorkspaceId() workspaceId: string) {
    return this.walletsService.list(workspaceId);
  }

  @Get('summary')
  @WorkspaceAuth(Permission.WALLET_VIEW)
  @SchemaResponse(WalletSummary)
  async summary(@WorkspaceId() workspaceId: string) {
    return this.walletsService.summary(workspaceId);
  }

  @Get('unlinked-statements')
  @WorkspaceAuth(Permission.WALLET_VIEW)
  @SchemaResponse(AccountStatementList)
  async unlinkedStatements(@WorkspaceId() workspaceId: string) {
    return this.walletsService.unlinkedStatements(workspaceId);
  }

  @Get(':id')
  @WorkspaceAuth(Permission.WALLET_VIEW)
  @SchemaResponse(WalletItem)
  async findOne(
    @SchemaParams(WalletParams) { id }: WalletParams,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.walletsService.findOneWithBalance(id, workspaceId);
  }

  @Get(':id/series')
  @WorkspaceAuth(Permission.WALLET_VIEW)
  @SchemaResponse(WalletSeries)
  async series(@SchemaParams(WalletParams) { id }: WalletParams, @WorkspaceId() workspaceId: string) {
    return this.walletsService.series(id, workspaceId);
  }

  @Get(':id/statements')
  @WorkspaceAuth(Permission.WALLET_VIEW)
  @SchemaResponse(AccountStatementList)
  async statementsOf(@SchemaParams(WalletParams) { id }: WalletParams, @WorkspaceId() workspaceId: string) {
    return this.walletsService.statementsOf(id, workspaceId);
  }

  @Post(':id/statements')
  @WorkspaceAuth(Permission.WALLET_EDIT)
  @SchemaResponse(AttachStatementsResult)
  async attachStatements(
    @SchemaParams(WalletParams) { id }: WalletParams,
    @SchemaBody(AttachStatementsBody) body: AttachStatementsBody,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.walletsService.attachStatements(id, workspaceId, body.statementIds);
  }

  @Delete(':id/statements/:statementId')
  @WorkspaceAuth(Permission.WALLET_EDIT)
  @SchemaResponse(MessageResult)
  async detachStatement(
    @SchemaParams(WalletStatementParams) { id, statementId }: WalletStatementParams,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.walletsService.detachStatement(id, workspaceId, statementId);
    return deletedResponse('Statement link');
  }

  @Put(':id')
  @WorkspaceAuth(Permission.WALLET_EDIT)
  @SchemaResponse(WalletItem)
  async update(
    @SchemaParams(WalletParams) { id }: WalletParams,
    @SchemaBody(UpdateWalletBody) updateDto: UpdateWalletBody,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.walletsService.update(id, workspaceId, updateDto);
    return this.walletsService.findOneWithBalance(id, workspaceId);
  }

  @Delete(':id')
  @WorkspaceAuth(Permission.WALLET_DELETE)
  @SchemaResponse(MessageResult)
  async remove(
    @SchemaParams(WalletParams) { id }: WalletParams,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.walletsService.remove(id, workspaceId);
    return deletedResponse('Wallet');
  }
}
