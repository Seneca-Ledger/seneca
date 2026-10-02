import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { Permission } from '../../common/enums/permissions.enum';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BankSyncService } from './bank-sync.service';
import { BankSyncErrorFilter } from './bank-sync-error.filter';
import { BankSyncPullService } from './bank-sync-pull.service';
import {
  BeginLinkDto,
  CompleteLinkDto,
  ConnectWithTokenDto,
  CreateRedirectConnectionDto,
  ListInstitutionsQueryDto,
  SwitchFeedDto,
  UpdateBankSyncAccountDto,
  UpdateConnectionDto,
} from './dto/bank-sync.dto';

@Controller('integrations/bank-sync')
@UseFilters(BankSyncErrorFilter)
export class BankSyncController {
  constructor(
    private readonly connections: BankSyncService,
    private readonly pull: BankSyncPullService,
  ) {}

  @Get('providers')
  @UseGuards(WorkspaceContextGuard)
  providers() {
    return this.connections.catalogue();
  }

  @Get('connections')
  @UseGuards(WorkspaceContextGuard)
  list(@WorkspaceId() workspaceId: string) {
    return this.connections.list(workspaceId);
  }

  @Post('connections/token')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  connectWithToken(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Body() body: ConnectWithTokenDto,
  ) {
    return this.connections.connectWithToken(
      user,
      workspaceId,
      body.provider,
      body.setupToken,
      body.label,
    );
  }

  @Post('connections/redirect')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  createRedirectConnection(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Body() body: CreateRedirectConnectionDto,
  ) {
    return this.connections.createRedirectConnection(
      user,
      workspaceId,
      body.provider,
      body.secrets,
      body.label,
    );
  }

  @Get('connections/:id/institutions')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  institutions(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListInstitutionsQueryDto,
  ) {
    return this.connections.listInstitutions(workspaceId, id, query.country);
  }

  @Post('connections/:id/links/begin')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  beginLink(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: BeginLinkDto,
  ) {
    return this.connections.beginLink(workspaceId, id, body);
  }

  @Post('connections/:id/links/complete')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  completeLink(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CompleteLinkDto,
  ) {
    return this.connections.completeLink(workspaceId, id, body.code, body.state);
  }

  @Post('connections/:id/accounts/refresh')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  refreshAccounts(@WorkspaceId() workspaceId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.connections.refreshAccounts(workspaceId, id);
  }

  @Patch('connections/:id')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  updateConnection(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateConnectionDto,
  ) {
    return this.connections.updateConnection(workspaceId, id, body);
  }

  @Patch('connections/:id/accounts/:accountId')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  updateAccount(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('accountId') accountId: string,
    @Body() body: UpdateBankSyncAccountDto,
  ) {
    return this.connections.updateAccount(workspaceId, id, accountId, body);
  }

  @Post('connections/:id/sync')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  sync(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.pull.sync(user, workspaceId, id);
  }

  /** Moves a wallet's feed to another provider without losing its history. */
  @Post('feeds/switch')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  switchFeed(@WorkspaceId() workspaceId: string, @Body() body: SwitchFeedDto) {
    return this.connections.switchFeed(workspaceId, body);
  }

  @Delete('connections/:id')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  disconnect(@WorkspaceId() workspaceId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.connections.disconnect(workspaceId, id);
  }
}
