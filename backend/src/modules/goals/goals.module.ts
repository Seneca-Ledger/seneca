import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Goal, GoalContribution } from '../../entities';
import { Budget } from '../../entities/budget.entity';
import { DataEntry } from '../../entities/data-entry.entity';
import { GoalItem } from '../../entities/goal-item.entity';
import { Transaction } from '../../entities/transaction.entity';
import { Workspace } from '../../entities/workspace.entity';
import { AuditModule } from '../audit/audit.module';
import { CategoriesModule } from '../categories/categories.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { WorkspaceCurrencyModule } from '../workspaces/workspace-currency.module';
import { GoalCoversService } from './goal-covers.service';
import { GoalFlowService } from './goal-flow.service';
import { GoalItemsService } from './goal-items.service';
import { GoalPlanService } from './goal-plan.service';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Goal,
      GoalContribution,
      GoalItem,
      Budget,
      Transaction,
      DataEntry,
      Workspace,
    ]),
    CategoriesModule,
    ExchangeRatesModule,
    AuditModule,
    WorkspaceCurrencyModule,
  ],
  controllers: [GoalsController],
  providers: [GoalsService, GoalFlowService, GoalItemsService, GoalPlanService, GoalCoversService],
  exports: [GoalsService, GoalFlowService, GoalItemsService, GoalPlanService, GoalCoversService],
})
export class GoalsModule {}
