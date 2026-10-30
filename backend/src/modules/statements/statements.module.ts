import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileStorageService } from '../../common/services/file-storage.service';
import { IdempotencyService } from '../../common/services/idempotency.service';
import { Category, TaxRate, User, Wallet, WorkspaceMember } from '../../entities';
import { IdempotencyKey } from '../../entities/idempotency-key.entity';
import { Statement } from '../../entities/statement.entity';
import { Transaction } from '../../entities/transaction.entity';
import { AuditModule } from '../audit/audit.module';
import { ParsingModule } from '../parsing/parsing.module';
import { ReceiptsModule } from '../receipts/receipts.module';
import { TaxModule } from '../tax/tax.module';
import { WorkspaceCurrencyModule } from '../workspaces/workspace-currency.module';
import { DroppedSampleService } from './dropped-sample.service';
import { ManualExpenseService } from './manual-expense.service';
import { ReceiptStatementService } from './services/receipt-statement.service';
import { ScanUploadService } from './services/scan-upload.service';
import { StatementStageService } from './services/statement-stage.service';
import { StatementFilesService } from './statement-files.service';
import { StatementTrashService } from './statement-trash.service';
import { StatementUploadService } from './statement-upload.service';
import { StatementUploadsController } from './statement-uploads.controller';
import { StatementsController } from './statements.controller';
import { StatementsService } from './statements.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Statement,
      Transaction,
      User,
      WorkspaceMember,
      IdempotencyKey,
      Category,
      TaxRate,
      Wallet,
    ]),
    AuditModule,
    ParsingModule,
    TaxModule,
    ReceiptsModule,
    WorkspaceCurrencyModule,
  ],
  controllers: [StatementUploadsController, StatementsController],
  providers: [
    StatementsService,
    StatementFilesService,
    StatementTrashService,
    ManualExpenseService,
    StatementUploadService,
    DroppedSampleService,
    ReceiptStatementService,
    ScanUploadService,
    StatementStageService,
    FileStorageService,
    IdempotencyService,
  ],
  exports: [StatementsService, ReceiptStatementService, FileStorageService],
})
export class StatementsModule {}
