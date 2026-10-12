import { Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { Permission } from '../../common/enums/permissions.enum';
import { deletedResponse } from '../../common/utils/responses.util';
import { CreateBudgetBody, UpdateBudgetBody } from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BudgetsService } from './budgets.service';
import { BudgetImpactQueryDto } from './dto/budget-impact-query.dto';
import { StoicLedgerService } from './stoic/stoic-ledger.service';

@Controller('budgets')
export class BudgetsController {
  constructor(
    private readonly budgetsService: BudgetsService,
    private readonly stoicLedgerService: StoicLedgerService,
  ) {}

  @Post()
  @WorkspaceAuth(Permission.BUDGET_CREATE)
  async create(
    @SchemaBody(CreateBudgetBody) createDto: CreateBudgetBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.budgetsService.create(workspaceId, user.id, createDto);
  }

  @Get()
  @WorkspaceAuth(Permission.BUDGET_VIEW)
  async findAll(@WorkspaceId() workspaceId: string) {
    return this.budgetsService.findAll(workspaceId);
  }

  /** Plan versus actual per Stoic class, plus how each expense category is judged. */
  @Get('stoic-balance')
  @WorkspaceAuth(Permission.BUDGET_VIEW)
  async stoicBalance(@WorkspaceId() workspaceId: string) {
    return this.stoicLedgerService.monthlyBalance(workspaceId);
  }

  /** What booking an expense would do to budgets and the default account; advice, not a gate. */
  @Get('impact')
  @WorkspaceAuth(Permission.BUDGET_VIEW)
  async impact(@Query() query: BudgetImpactQueryDto, @WorkspaceId() workspaceId: string) {
    return this.budgetsService.getImpact(workspaceId, query);
  }

  @Get(':id')
  @WorkspaceAuth(Permission.BUDGET_VIEW)
  async findOne(@Param('id') id: string, @WorkspaceId() workspaceId: string) {
    return this.budgetsService.findOne(id, workspaceId);
  }

  @Put(':id')
  @WorkspaceAuth(Permission.BUDGET_EDIT)
  async update(
    @Param('id') id: string,
    @SchemaBody(UpdateBudgetBody) updateDto: UpdateBudgetBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.budgetsService.update(id, workspaceId, user.id, updateDto);
  }

  @Delete(':id')
  @WorkspaceAuth(Permission.BUDGET_DELETE)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.budgetsService.remove(id, workspaceId, user.id);
    return deletedResponse('Budget');
  }
}
