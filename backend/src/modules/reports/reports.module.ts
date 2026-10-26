import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Branch } from '../../entities/branch.entity';
import { Budget } from '../../entities/budget.entity';
import { Category } from '../../entities/category.entity';
import { CustomTable } from '../../entities/custom-table.entity';
import { CustomTableColumn } from '../../entities/custom-table-column.entity';
import { CustomTableRow } from '../../entities/custom-table-row.entity';
import { ReportHistory } from '../../entities/report-history.entity';
import { ReportSchedule } from '../../entities/report-schedule.entity';
import { Transaction } from '../../entities/transaction.entity';
import { User } from '../../entities/user.entity';
import { Wallet } from '../../entities/wallet.entity';
import { Workspace } from '../../entities/workspace.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { ApplicationSettingsModule } from '../application-settings/application-settings.module';
import { AuditModule } from '../audit/audit.module';
import { BalanceModule } from '../balance/balance.module';
import { CryptoModule } from '../crypto/crypto.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { InvestmentsModule } from '../investments/investments.module';
import { BudgetVsActualReport } from './budget-vs-actual.report';
import { CashFlowMapService } from './cash-flow-map.service';
import { HoldingsSnapshotReport } from './holdings-snapshot.report';
import { ReportRetentionService } from './report-retention.service';
import { ReportSchedulesController } from './report-schedules.controller';
import { ReportSchedulesScheduler } from './report-schedules.scheduler';
import { ReportSchedulesService } from './report-schedules.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { SpendFlowService } from './spend-flow.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transaction,
      Category,
      Budget,
      Branch,
      Wallet,
      CustomTable,
      CustomTableColumn,
      CustomTableRow,
      User,
      ReportHistory,
      ReportSchedule,
      Workspace,
      WorkspaceMember,
    ]),
    ApplicationSettingsModule,
    AuditModule,
    BalanceModule,
    CryptoModule,
    ExchangeRatesModule,
    InvestmentsModule,
  ],
  controllers: [ReportsController, ReportSchedulesController],
  providers: [
    ReportsService,
    ReportSchedulesService,
    ReportSchedulesScheduler,
    ReportRetentionService,
    SpendFlowService,
    CashFlowMapService,
    BudgetVsActualReport,
    HoldingsSnapshotReport,
  ],
  exports: [ReportsService, ReportSchedulesService],
})
export class ReportsModule {}
