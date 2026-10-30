import { Controller, Get, Put } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import {
  SetTransactionGoalBody,
  TransactionGoalLink,
  TransactionGoalParams,
} from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GoalTransactionLinkService } from './goal-transaction-link.service';

/** The goal a transaction counts toward, read and set from a receipt or a statement row. */
@Controller('transactions')
export class GoalTransactionLinkController {
  constructor(private readonly linkService: GoalTransactionLinkService) {}

  @Get(':id/goal')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW, Permission.GOAL_VIEW)
  @SchemaResponse(TransactionGoalLink)
  async getGoal(
    @SchemaParams(TransactionGoalParams) { id }: TransactionGoalParams,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.linkService.get(workspaceId, id);
  }

  @Put(':id/goal')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT, Permission.GOAL_EDIT)
  @SchemaResponse(TransactionGoalLink)
  async setGoal(
    @SchemaParams(TransactionGoalParams) { id }: TransactionGoalParams,
    @SchemaBody(SetTransactionGoalBody) body: SetTransactionGoalBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.linkService.set(workspaceId, user.id, id, body.goalId, body.goalItemId);
  }
}
