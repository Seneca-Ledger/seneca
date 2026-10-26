import { Controller, Delete, Get, Post, Put } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { deletedResponse } from '../../common/utils/responses.util';
import {
  CreateWalletBody,
  MessageResult,
  UpdateWalletBody,
  WalletItem,
  WalletList,
  WalletParams,
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
    @SchemaBody(CreateWalletBody) createDto: CreateWalletBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    const created = await this.walletsService.create(workspaceId, user.id, createDto);
    // The stored form, as the list reads it: defaults filled, decimals as strings.
    return this.walletsService.findOne(created.id, workspaceId);
  }

  @Get()
  @WorkspaceAuth(Permission.WALLET_VIEW)
  @SchemaResponse(WalletList)
  async findAll(@CurrentUser() _user: User, @WorkspaceId() workspaceId: string) {
    return this.walletsService.findAll(workspaceId);
  }

  @Get(':id')
  @WorkspaceAuth(Permission.WALLET_VIEW)
  @SchemaResponse(WalletItem)
  async findOne(
    @SchemaParams(WalletParams) { id }: WalletParams,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.walletsService.findOne(id, workspaceId);
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
    return this.walletsService.findOne(id, workspaceId);
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
