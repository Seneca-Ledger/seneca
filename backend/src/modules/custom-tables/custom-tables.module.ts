import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../../entities/category.entity';
import { CustomTable } from '../../entities/custom-table.entity';
import { CustomTableCellStyle } from '../../entities/custom-table-cell-style.entity';
import { CustomTableColumn } from '../../entities/custom-table-column.entity';
import { CustomTableColumnStyle } from '../../entities/custom-table-column-style.entity';
import { CustomTableExportSchedule } from '../../entities/custom-table-export-schedule.entity';
import { CustomTableRow } from '../../entities/custom-table-row.entity';
import { CustomTableRowComment } from '../../entities/custom-table-row-comment.entity';
import { CustomTableShare } from '../../entities/custom-table-share.entity';
import { DataEntry } from '../../entities/data-entry.entity';
import { DataEntryCustomField } from '../../entities/data-entry-custom-field.entity';
import { Invoice } from '../../entities/invoice.entity';
import { Payable } from '../../entities/payable.entity';
import { Statement } from '../../entities/statement.entity';
import { Subscription } from '../../entities/subscription.entity';
import { Transaction } from '../../entities/transaction.entity';
import { User } from '../../entities/user.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { AuditModule } from '../audit/audit.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { ClassificationModule } from '../classification/classification.module';
import { WorkspaceCurrencyModule } from '../workspaces/workspace-currency.module';
import { CustomTableCommentsController } from './custom-table-comments.controller';
import { CustomTableCommentsService } from './custom-table-comments.service';
import { CustomTableExportSchedulesScheduler } from './custom-table-export-schedules.scheduler';
import { CustomTableExportSchedulesService } from './custom-table-export-schedules.service';
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
      DataEntry,
      DataEntryCustomField,
      Category,
      Statement,
      Transaction,
      Subscription,
      Payable,
      Invoice,
      User,
      WorkspaceMember,
    ]),
    AuditModule,
    BudgetsModule,
    ClassificationModule,
    BullModule.registerQueue({ name: CUSTOM_TABLE_RECALC_QUEUE }),
    WorkspaceCurrencyModule,
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
  ],
  exports: [CustomTablesService],
})
export class CustomTablesModule {}
