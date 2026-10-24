import { Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { deletedResponse } from '../../common/utils/responses.util';
import {
  AttachStatementsBody,
  AttachStatementsResult,
  CreateWalletRequest,
  UnlinkedStatementList,
  UpdateWalletBody,
  WalletItem,
  WalletList,
  WalletSeries,
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
  async create(
    @SchemaBody(CreateWalletRequest) createDto: CreateWalletRequest,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.walletsService.create(workspaceId, user.id, createDto);
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
  @SchemaResponse(UnlinkedStatementList)
  async unlinkedStatements(@WorkspaceId() workspaceId: string) {
    return this.walletsService.unlinkedStatements(workspaceId);
  }

  @Get(':id')
  @WorkspaceAuth(Permission.WALLET_VIEW)
  @SchemaResponse(WalletItem)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.walletsService.findOneWithBalance(id, workspaceId);
  }

  @Get(':id/series')
  @WorkspaceAuth(Permission.WALLET_VIEW)
  @SchemaResponse(WalletSeries)
  async series(@Param('id', ParseUUIDPipe) id: string, @WorkspaceId() workspaceId: string) {
    return this.walletsService.series(id, workspaceId);
  }

  @Post(':id/statements')
  @WorkspaceAuth(Permission.WALLET_EDIT)
  @SchemaResponse(AttachStatementsResult)
  async attachStatements(
    @Param('id', ParseUUIDPipe) id: string,
    @SchemaBody(AttachStatementsBody) body: AttachStatementsBody,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.walletsService.attachStatements(id, workspaceId, body.statementIds);
  }

  @Delete(':id/statements/:statementId')
  @WorkspaceAuth(Permission.WALLET_EDIT)
  async detachStatement(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('statementId', ParseUUIDPipe) statementId: string,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.walletsService.detachStatement(id, workspaceId, statementId);
    return deletedResponse('Statement link');
  }

  @Put(':id')
  @WorkspaceAuth(Permission.WALLET_EDIT)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @SchemaBody(UpdateWalletBody) updateDto: UpdateWalletBody,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.walletsService.update(id, workspaceId, updateDto);
  }

  @Delete(':id')
  @WorkspaceAuth(Permission.WALLET_DELETE)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.walletsService.remove(id, workspaceId);
    return deletedResponse('Wallet');
  }
}
