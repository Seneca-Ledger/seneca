import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../../entities/category.entity';
import { Client } from '../../entities/client.entity';
import { CustomTable } from '../../entities/custom-table.entity';
import { CustomTableCellStyle } from '../../entities/custom-table-cell-style.entity';
import { CustomTableColumn } from '../../entities/custom-table-column.entity';
import { CustomTableColumnStyle } from '../../entities/custom-table-column-style.entity';
import { CustomTableExportSchedule } from '../../entities/custom-table-export-schedule.entity';
import { CustomTableRow } from '../../entities/custom-table-row.entity';
import { CustomTableRowComment } from '../../entities/custom-table-row-comment.entity';
import { CustomTableShare } from '../../entities/custom-table-share.entity';
import { CustomTableSourceEdit } from '../../entities/custom-table-source-edit.entity';
import { DataEntry } from '../../entities/data-entry.entity';
import { DataEntryCustomField } from '../../entities/data-entry-custom-field.entity';
import { Invoice } from '../../entities/invoice.entity';
import { Payable } from '../../entities/payable.entity';
import { Receipt } from '../../entities/receipt.entity';
import { Statement } from '../../entities/statement.entity';
import { Subscription } from '../../entities/subscription.entity';
import { Transaction } from '../../entities/transaction.entity';
import { User } from '../../entities/user.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { AuditModule } from '../audit/audit.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { ClassificationModule } from '../classification/classification.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { PayablesModule } from '../payables/payables.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TaxModule } from '../tax/tax.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { WorkspaceCurrencyModule } from '../workspaces/workspace-currency.module';
import { CustomTableCommentsController } from './custom-table-comments.controller';
import { CustomTableCommentsService } from './custom-table-comments.service';
import { CustomTableExportSchedulesScheduler } from './custom-table-export-schedules.scheduler';
import { CustomTableExportSchedulesService } from './custom-table-export-schedules.service';
import { CustomTableMoneyTotalService } from './custom-table-money-total.service';
import {
  CustomTableSharesController,
  PublicCustomTableSharesController,
} from './custom-table-shares.controller';
import { CustomTableSharesService } from './custom-table-shares.service';
import { CustomTableSourcesService } from './custom-table-sources.service';
import { CustomTablesController } from './custom-tables.controller';
import { CustomTablesService } from './custom-tables.service';
import { CustomTablesCacheService } from './custom-tables-cache.service';
import { FormulaRecalcService } from './formula-recalc.service';
import { CustomTableRecalcProcessor } from './queue/custom-table-recalc.processor';
import { CUSTOM_TABLE_RECALC_QUEUE } from './queue/custom-table-recalc.queue';
import { SourceWriteBackService } from './write-back/source-write-back.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CustomTable,
      CustomTableColumnStyle,
      CustomTableColumn,
      CustomTableRow,
      CustomTableCellStyle,
      CustomTableShare,
      CustomTableExportSchedule,
      CustomTableRowComment,
      CustomTableSourceEdit,
      Client,
      DataEntry,
      DataEntryCustomField,
      Category,
      Statement,
      Transaction,
      Subscription,
      Payable,
      Invoice,
      Receipt,
      User,
      WorkspaceMember,
    ]),
    AuditModule,
    BudgetsModule,
    ClassificationModule,
    ExchangeRatesModule,
    BullModule.registerQueue({ name: CUSTOM_TABLE_RECALC_QUEUE }),
    WorkspaceCurrencyModule,
    TaxModule,
    // Cells of tables filled from app data write back through these services.
    TransactionsModule,
    SubscriptionsModule,
    PayablesModule,
    InvoicesModule,
  ],
  controllers: [
    CustomTablesController,
    CustomTableSharesController,
    PublicCustomTableSharesController,
    CustomTableCommentsController,
  ],
  providers: [
    CustomTablesService,
    CustomTablesCacheService,
    CustomTableSourcesService,
    FormulaRecalcService,
    CustomTableRecalcProcessor,
    CustomTableSharesService,
    CustomTableExportSchedulesService,
    CustomTableExportSchedulesScheduler,
    CustomTableCommentsService,
    CustomTableMoneyTotalService,
    SourceWriteBackService,
  ],
  exports: [CustomTablesService],
})
export class CustomTablesModule {}
