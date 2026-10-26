import { Controller, Get, Post } from '@nestjs/common';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import {
  TransactionHistory,
  TransactionHistoryEventParams,
  TransactionParams,
} from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TransactionHistoryService } from './services/transaction-history.service';

/** A transaction's History tab: what changed on the row, and undoing the latest change of a field. */
@Controller('transactions')
export class TransactionHistoryController {
  constructor(private readonly transactionHistoryService: TransactionHistoryService) {}

  @Get(':id/history')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  @SchemaResponse(TransactionHistory)
  history(
    @SchemaParams(TransactionParams) { id }: TransactionParams,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return this.transactionHistoryService.history(workspaceId, user.id, id, selfMemberId);
  }

  @Post(':id/history/:eventId/undo')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @SchemaResponse(TransactionHistory)
  undoHistory(
    @SchemaParams(TransactionHistoryEventParams) { id, eventId }: TransactionHistoryEventParams,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return this.transactionHistoryService.undo(workspaceId, user.id, id, eventId, selfMemberId);
  }
}
