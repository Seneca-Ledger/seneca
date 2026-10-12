import { Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { Permission } from '../../common/enums/permissions.enum';
import { deletedResponse } from '../../common/utils/responses.util';
import { CreateWalletBody, UpdateWalletBody } from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WalletsService } from './wallets.service';

@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Post()
  @WorkspaceAuth(Permission.WALLET_CREATE)
  async create(
    @SchemaBody(CreateWalletBody) createDto: CreateWalletBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.walletsService.create(workspaceId, user.id, createDto);
  }

  @Get()
  @WorkspaceAuth(Permission.WALLET_VIEW)
  async findAll(@CurrentUser() _user: User, @WorkspaceId() workspaceId: string) {
    return this.walletsService.findAll(workspaceId);
  }

  @Get(':id')
  @WorkspaceAuth(Permission.WALLET_VIEW)
  async findOne(
    @Param('id') id: string,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.walletsService.findOne(id, workspaceId);
  }

  @Put(':id')
  @WorkspaceAuth(Permission.WALLET_EDIT)
  async update(
    @Param('id') id: string,
    @SchemaBody(UpdateWalletBody) updateDto: UpdateWalletBody,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.walletsService.update(id, workspaceId, updateDto);
  }

  @Delete(':id')
  @WorkspaceAuth(Permission.WALLET_DELETE)
  async remove(
    @Param('id') id: string,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.walletsService.remove(id, workspaceId);
    return deletedResponse('Wallet');
  }
}
