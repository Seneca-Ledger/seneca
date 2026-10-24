import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Budget } from '../../entities/budget.entity';
import { CategorizationRule } from '../../entities/categorization-rule.entity';
import { Category } from '../../entities/category.entity';
import { Goal } from '../../entities/goal.entity';
import { Payable } from '../../entities/payable.entity';
import { Receipt } from '../../entities/receipt.entity';
import { Statement } from '../../entities/statement.entity';
import { Subscription } from '../../entities/subscription.entity';
import { Transaction } from '../../entities/transaction.entity';
import { Workspace } from '../../entities/workspace.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { ApplicationSettingsModule } from '../application-settings/application-settings.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { SetupProgressController } from './setup-progress.controller';
import { SetupProgressService } from './setup-progress.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transaction,
      Statement,
      Payable,
      Receipt,
      WorkspaceMember,
      Workspace,
      Subscription,
      Category,
      CategorizationRule,
      Budget,
      Goal,
    ]),
    ExchangeRatesModule,
    ApplicationSettingsModule,
    // Budgets → notifications → telegram → insights lead back here.
    forwardRef(() => BudgetsModule),
  ],
  controllers: [DashboardController, SetupProgressController],
  providers: [DashboardService, SetupProgressService],
  exports: [DashboardService],
})
export class DashboardModule {}
