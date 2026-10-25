import { Controller, Delete, Get, Post, Put } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams, SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { deletedResponse } from '../../common/utils/responses.util';
import {
  BudgetImpact,
  BudgetImpactQuery,
  BudgetItem,
  BudgetList,
  BudgetListQuery,
  BudgetParams,
  CreateBudgetBody,
  MessageResult,
  StoicBalance,
  UpdateBudgetBody,
} from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { parseDateOnly } from './budget-period.util';
import { BudgetsService } from './budgets.service';
import { StoicLedgerService } from './stoic/stoic-ledger.service';

@Controller('budgets')
export class BudgetsController {
  constructor(
    private readonly budgetsService: BudgetsService,
    private readonly stoicLedgerService: StoicLedgerService,
  ) {}

  @Post()
  @WorkspaceAuth(Permission.BUDGET_CREATE)
  @SchemaResponse(BudgetItem)
  async create(
    @SchemaBody(CreateBudgetBody) createDto: CreateBudgetBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    const saved = await this.budgetsService.create(workspaceId, user.id, createDto);
    // Answered as the list has it: the saved entity holds the limit as sent, not as stored.
    return this.budgetsService.findOne(saved.id, workspaceId);
  }

  @Get()
  @WorkspaceAuth(Permission.BUDGET_VIEW)
  @SchemaResponse(BudgetList)
  async findAll(
    @SchemaQuery(BudgetListQuery) query: BudgetListQuery,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.budgetsService.findAll(
      workspaceId,
      query.date ? parseDateOnly(query.date) : undefined,
    );
  }

  /** Plan versus actual per Stoic class, plus how each expense category is judged. */
  @Get('stoic-balance')
  @WorkspaceAuth(Permission.BUDGET_VIEW)
  @SchemaResponse(StoicBalance)
  async stoicBalance(@WorkspaceId() workspaceId: string) {
    return this.stoicLedgerService.monthlyBalance(workspaceId);
  }

  /** What booking an expense would do to budgets and the default account; advice, not a gate. */
  @Get('impact')
  @WorkspaceAuth(Permission.BUDGET_VIEW)
  @SchemaResponse(BudgetImpact)
  async impact(
    @SchemaQuery(BudgetImpactQuery) query: BudgetImpactQuery,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.budgetsService.getImpact(workspaceId, query);
  }

  @Get(':id')
  @WorkspaceAuth(Permission.BUDGET_VIEW)
  @SchemaResponse(BudgetItem)
  async findOne(
    @SchemaParams(BudgetParams) { id }: BudgetParams,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.budgetsService.findOne(id, workspaceId);
  }

  @Put(':id')
  @WorkspaceAuth(Permission.BUDGET_EDIT)
  @SchemaResponse(BudgetItem)
  async update(
    @SchemaParams(BudgetParams) { id }: BudgetParams,
    @SchemaBody(UpdateBudgetBody) updateDto: UpdateBudgetBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.budgetsService.update(id, workspaceId, user.id, updateDto);
    return this.budgetsService.findOne(id, workspaceId);
  }

  @Delete(':id')
  @WorkspaceAuth(Permission.BUDGET_DELETE)
  @SchemaResponse(MessageResult)
  async remove(
    @SchemaParams(BudgetParams) { id }: BudgetParams,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.budgetsService.remove(id, workspaceId, user.id);
    return deletedResponse('Budget');
  }
}
