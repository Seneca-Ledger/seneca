import { Controller, Delete, Get, Patch, Post, UseFilters } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams, SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import {
  BankSyncAccountParams,
  BankSyncConnection,
  BankSyncConnectionList,
  BankSyncConnectionParams,
  BankSyncFeedSwitched,
  BankSyncInstitutionList,
  BankSyncInstitutionsQuery,
  BankSyncLinkStarted,
  BankSyncProviderList,
  BankSyncResult,
  BeginBankSyncLinkBody,
  CompleteBankSyncLinkBody,
  ConnectBankSyncTokenBody,
  CreateBankSyncRedirectBody,
  IntegrationDisconnected,
  SwitchBankSyncFeedBody,
  UpdateBankSyncAccountBody,
  UpdateBankSyncConnectionBody,
} from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BankSyncService } from './bank-sync.service';
import { BankSyncErrorFilter } from './bank-sync-error.filter';
import { BankSyncPullService } from './bank-sync-pull.service';

@Controller('integrations/bank-sync')
@UseFilters(BankSyncErrorFilter)
export class BankSyncController {
  constructor(
    private readonly connections: BankSyncService,
    private readonly pull: BankSyncPullService,
  ) {}

  @Get('providers')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @SchemaResponse(BankSyncProviderList)
  providers() {
    return this.connections.catalogue();
  }

  @Get('connections')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @SchemaResponse(BankSyncConnectionList)
  list(@WorkspaceId() workspaceId: string) {
    return this.connections.list(workspaceId);
  }

  @Post('connections/token')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @SchemaResponse(BankSyncConnection)
  connectWithToken(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(ConnectBankSyncTokenBody) body: ConnectBankSyncTokenBody,
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
  @SchemaResponse(BankSyncConnection)
  createRedirectConnection(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(CreateBankSyncRedirectBody) body: CreateBankSyncRedirectBody,
  ) {
    return this.connections.createRedirectConnection(
      user,
      workspaceId,
      body.provider,
      { ...body.secrets },
      body.label,
    );
  }

  @Get('connections/:id/institutions')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @SchemaResponse(BankSyncInstitutionList)
  institutions(
    @WorkspaceId() workspaceId: string,
    @SchemaParams(BankSyncConnectionParams) params: BankSyncConnectionParams,
    @SchemaQuery(BankSyncInstitutionsQuery) query: BankSyncInstitutionsQuery,
  ) {
    return this.connections.listInstitutions(workspaceId, params.id, query.country);
  }

  @Post('connections/:id/links/begin')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @SchemaResponse(BankSyncLinkStarted)
  beginLink(
    @WorkspaceId() workspaceId: string,
    @SchemaParams(BankSyncConnectionParams) params: BankSyncConnectionParams,
    @SchemaBody(BeginBankSyncLinkBody) body: BeginBankSyncLinkBody,
  ) {
    return this.connections.beginLink(workspaceId, params.id, body);
  }

  @Post('connections/:id/links/complete')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @SchemaResponse(BankSyncConnection)
  completeLink(
    @WorkspaceId() workspaceId: string,
    @SchemaParams(BankSyncConnectionParams) params: BankSyncConnectionParams,
    @SchemaBody(CompleteBankSyncLinkBody) body: CompleteBankSyncLinkBody,
  ) {
    return this.connections.completeLink(workspaceId, params.id, body.code, body.state);
  }

  @Post('connections/:id/accounts/refresh')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @SchemaResponse(BankSyncConnection)
  refreshAccounts(
    @WorkspaceId() workspaceId: string,
    @SchemaParams(BankSyncConnectionParams) params: BankSyncConnectionParams,
  ) {
    return this.connections.refreshAccounts(workspaceId, params.id);
  }

  @Patch('connections/:id')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @SchemaResponse(BankSyncConnection)
  updateConnection(
    @WorkspaceId() workspaceId: string,
    @SchemaParams(BankSyncConnectionParams) params: BankSyncConnectionParams,
    @SchemaBody(UpdateBankSyncConnectionBody) body: UpdateBankSyncConnectionBody,
  ) {
    return this.connections.updateConnection(workspaceId, params.id, body);
  }

  @Patch('connections/:id/accounts/:accountId')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @SchemaResponse(BankSyncConnection)
  updateAccount(
    @WorkspaceId() workspaceId: string,
    @SchemaParams(BankSyncAccountParams) params: BankSyncAccountParams,
    @SchemaBody(UpdateBankSyncAccountBody) body: UpdateBankSyncAccountBody,
  ) {
    return this.connections.updateAccount(workspaceId, params.id, params.accountId, body);
  }

  @Post('connections/:id/sync')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @SchemaResponse(BankSyncResult)
  sync(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(BankSyncConnectionParams) params: BankSyncConnectionParams,
  ) {
    return this.pull.sync(user, workspaceId, params.id);
  }

  /** Moves a wallet's feed to another provider without losing its history. */
  @Post('feeds/switch')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @SchemaResponse(BankSyncFeedSwitched)
  switchFeed(
    @WorkspaceId() workspaceId: string,
    @SchemaBody(SwitchBankSyncFeedBody) body: SwitchBankSyncFeedBody,
  ) {
    return this.connections.switchFeed(workspaceId, body);
  }

  @Delete('connections/:id')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @SchemaResponse(IntegrationDisconnected)
  disconnect(
    @WorkspaceId() workspaceId: string,
    @SchemaParams(BankSyncConnectionParams) params: BankSyncConnectionParams,
  ) {
    return this.connections.disconnect(workspaceId, params.id);
  }
}
