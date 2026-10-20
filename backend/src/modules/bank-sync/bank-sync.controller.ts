import { Controller, Delete, Get, Post } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { BankSyncStatus, ConnectBankSyncBody, UpdateBankSyncSettingsBody } from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BankSyncService } from './bank-sync.service';

@Controller('integrations/simplefin')
export class BankSyncController {
  constructor(private readonly bankSyncService: BankSyncService) {}

  @Get('status')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @SchemaResponse(BankSyncStatus)
  status(@WorkspaceId() workspaceId: string) {
    return this.bankSyncService.status(workspaceId);
  }

  @Post('connect')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  connect(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(ConnectBankSyncBody) body: ConnectBankSyncBody,
  ) {
    return this.bankSyncService.connect(user, workspaceId, body.setupToken);
  }

  @Post('settings')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  updateSettings(
    @WorkspaceId() workspaceId: string,
    @SchemaBody(UpdateBankSyncSettingsBody) body: UpdateBankSyncSettingsBody,
  ) {
    return this.bankSyncService.updateSettings(workspaceId, body);
  }

  @Post('accounts/refresh')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  refreshAccounts(@WorkspaceId() workspaceId: string) {
    return this.bankSyncService.refreshAccounts(workspaceId);
  }

  @Post('sync')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  sync(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    return this.bankSyncService.sync(user, workspaceId);
  }

  @Delete()
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  disconnect(@WorkspaceId() workspaceId: string) {
    return this.bankSyncService.disconnect(workspaceId);
  }
}
