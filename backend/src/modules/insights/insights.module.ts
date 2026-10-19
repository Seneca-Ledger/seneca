import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Budget,
  Category,
  Insight,
  Subscription,
  Transaction,
  User,
  Workspace,
} from '../../entities';
import { StoicLedgerService } from '../budgets/stoic/stoic-ledger.service';
import { DashboardModule } from '../dashboard/dashboard.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { GoalsModule } from '../goals/goals.module';
import { NetWorthModule } from '../net-worth/net-worth.module';
import { FinancialAnalyzer } from './analyzers/financial.analyzer';
import { OperationalAnalyzer } from './analyzers/operational.analyzer';
import { StoicAnalyzer } from './analyzers/stoic.analyzer';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';
import { DailyQuoteService } from './quotes/daily-quote.service';
import { StoicBehaviorService } from './stoic/stoic-behavior.service';

/**
 * StoicLedgerService is provided here rather than imported through its module:
 * BudgetsModule reaches InsightsModule back through Notifications → Telegram.
 * The service is stateless, so a second instance costs nothing.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Insight,
      Transaction,
      Budget,
      Category,
      User,
      Workspace,
      Subscription,
    ]),
    NetWorthModule,
    ExchangeRatesModule,
    GoalsModule,
    DashboardModule,
  ],
  controllers: [InsightsController],
  providers: [
    InsightsService,
    OperationalAnalyzer,
    FinancialAnalyzer,
    StoicAnalyzer,
    StoicLedgerService,
    StoicBehaviorService,
    DailyQuoteService,
  ],
  exports: [InsightsService],
})
export class InsightsModule {}
