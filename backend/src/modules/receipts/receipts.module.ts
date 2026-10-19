import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Category,
  Receipt,
  ReceiptProcessingJob,
  Statement,
  Transaction,
  User,
  WorkspaceMember,
} from '../../entities';
import { AuditModule } from '../audit/audit.module';
import { ClassificationModule } from '../classification/classification.module';
import { GeocodingModule } from '../geocoding/geocoding.module';
import { ParsingModule } from '../parsing/parsing.module';
import { TaxModule } from '../tax/tax.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { WorkspaceCurrencyModule } from '../workspaces/workspace-currency.module';
import { ReceiptsController } from './receipts.controller';
import { ReceiptsService } from './receipts.service';
import { ReceiptCategoryService } from './services/receipt-category.service';
import { ReceiptDuplicateService } from './services/receipt-duplicate.service';
import { ReceiptLocationService } from './services/receipt-location.service';
import { ReceiptMatchService } from './services/receipt-match.service';
import { ReceiptPlaceSuggestionService } from './services/receipt-place-suggestion.service';
import { ReceiptProcessorService } from './services/receipt-processor.service';
import { ReceiptSplitService } from './services/receipt-split.service';
import { ReceiptStageService } from './services/receipt-stage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Receipt,
      ReceiptProcessingJob,
      Category,
      Statement,
      Transaction,
      User,
      WorkspaceMember,
    ]),
    AuditModule,
    ParsingModule,
    ClassificationModule,
    GeocodingModule,
    WorkspaceCurrencyModule,
    TransactionsModule,
    TaxModule,
  ],
  controllers: [ReceiptsController],
  providers: [
    ReceiptsService,
    ReceiptCategoryService,
    ReceiptDuplicateService,
    ReceiptLocationService,
    ReceiptPlaceSuggestionService,
    ReceiptProcessorService,
    ReceiptStageService,
    ReceiptMatchService,
    ReceiptSplitService,
  ],
  exports: [ReceiptsService, ReceiptCategoryService, ReceiptDuplicateService, ReceiptMatchService],
})
export class ReceiptsModule {}
