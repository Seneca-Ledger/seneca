import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Budget } from '../../entities/budget.entity';
import { Category } from '../../entities/category.entity';
import { Goal } from '../../entities/goal.entity';
import { Subscription } from '../../entities/subscription.entity';
import { SubscriptionCharge } from '../../entities/subscription-charge.entity';
import { Transaction } from '../../entities/transaction.entity';
import { Wallet } from '../../entities/wallet.entity';
import { Workspace } from '../../entities/workspace.entity';
import { AuditModule } from '../audit/audit.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WorkspaceCurrencyModule } from '../workspaces/workspace-currency.module';
import { BudgetEventsListener } from './budget-events.listener';
import { BudgetWithinLimitService } from './budget-within-limit.service';
import { BudgetsController } from './budgets.controller';
import { BudgetsService } from './budgets.service';
import { StoicLedgerService } from './stoic/stoic-ledger.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Budget,
      Category,
      Goal,
      Subscription,
      SubscriptionCharge,
      Transaction,
      Wallet,
      Workspace,
    ]),
    NotificationsModule,
    ExchangeRatesModule,
    AuditModule,
    WorkspaceCurrencyModule,
  ],
  controllers: [BudgetsController],
  providers: [BudgetsService, BudgetWithinLimitService, BudgetEventsListener, StoicLedgerService],
  exports: [BudgetsService, BudgetWithinLimitService, StoicLedgerService],
})
export class BudgetsModule {}
