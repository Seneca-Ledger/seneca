import { Controller, Get, HttpCode, Post, Put } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import {
  EnableLedgerBody,
  LedgerIntegrity as LedgerIntegrityContract,
  LedgerSettings as LedgerSettingsContract,
} from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { LedgerIntegrity, LedgerSettings } from './ledger-sync.service';
import { LedgerSyncService } from './ledger-sync.service';

/** Switching the ledger on, and checking that it keeps up with its sources. */
@Controller('ledger')
export class LedgerSettingsController {
  constructor(private readonly syncService: LedgerSyncService) {}

  @Get('settings')
  @WorkspaceAuth(Permission.LEDGER_VIEW)
  @SchemaResponse(LedgerSettingsContract)
  async getSettings(@WorkspaceId() workspaceId: string): Promise<LedgerSettings> {
    return this.syncService.getSettings(workspaceId);
  }

  /** Enables the ledger in a base currency and queues the whole history. Audited by the service. */
  @Put('settings')
  @WorkspaceAuth(Permission.LEDGER_MANAGE_ACCOUNTS)
  async enable(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(EnableLedgerBody) dto: EnableLedgerBody,
  ): Promise<LedgerSettings> {
    return this.syncService.enable(workspaceId, user.id, dto.baseCurrency);
  }

  @Get('integrity')
  @WorkspaceAuth(Permission.LEDGER_VIEW)
  @SchemaResponse(LedgerIntegrityContract)
  async integrity(@WorkspaceId() workspaceId: string): Promise<LedgerIntegrity> {
    return this.syncService.integrity(workspaceId);
  }

  /** Asks for a sync now instead of at the next sweep. */
  @Post('sync')
  @HttpCode(202)
  @WorkspaceAuth(Permission.LEDGER_MANAGE_ACCOUNTS)
  async sync(@WorkspaceId() workspaceId: string): Promise<{ queued: true }> {
    await this.syncService.requestSync(workspaceId);
    return { queued: true };
  }
}
