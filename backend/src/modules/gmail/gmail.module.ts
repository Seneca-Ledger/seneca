import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Category,
  GmailSettings,
  GmailWatchSubscription,
  Integration,
  IntegrationToken,
  Receipt,
  ReceiptProcessingJob,
  Transaction,
  User,
  Workspace,
  WorkspaceMember,
} from '../../entities';
import { AuditModule } from '../audit/audit.module';
import { ParsingModule } from '../parsing/parsing.module';
import { ReceiptsModule } from '../receipts/receipts.module';
import { WorkspaceCurrencyModule } from '../workspaces/workspace-currency.module';
import { GmailController } from './gmail.controller';
import { GmailScheduler } from './gmail.scheduler';
import { GmailReceiptProcessor } from './gmail-receipt-processor';
import { GmailWebhookController } from './gmail-webhook.controller';
import { AiMerchantExtractor } from './helpers/ai-merchant-extractor.helper';
import { GmailService } from './services/gmail.service';
import { GmailMerchantReparseService } from './services/gmail-merchant-reparse.service';
import { GmailOAuthService } from './services/gmail-oauth.service';
import { GmailReceiptCategoryService } from './services/gmail-receipt-category.service';
import { GmailReceiptDuplicateService } from './services/gmail-receipt-duplicate.service';
import { GmailReceiptExportService } from './services/gmail-receipt-export.service';
import { GmailReceiptParserService } from './services/gmail-receipt-parser.service';
import { GmailSyncService } from './services/gmail-sync.service';
import { GmailWatchService } from './services/gmail-watch.service';
import { GmailWebhookService } from './services/gmail-webhook.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Integration,
      IntegrationToken,
      GmailSettings,
      GmailWatchSubscription,
      Receipt,
      ReceiptProcessingJob,
      User,
      Transaction,
      Workspace,
      WorkspaceMember,
      Category,
    ]),
    AuditModule,
    ParsingModule,
    ReceiptsModule,
    // GoogleDriveModule removed: GmailReceiptExportService now uses GmailOAuthService
    WorkspaceCurrencyModule,
  ],
  controllers: [GmailController, GmailWebhookController],
  providers: [
    GmailOAuthService,
    GmailService,
    GmailWatchService,
    GmailWebhookService,
    GmailSyncService,
    {
      provide: AiMerchantExtractor,
      useFactory: () => new AiMerchantExtractor(process.env.AI_API_KEY),
    },
    GmailReceiptParserService,
    GmailReceiptDuplicateService,
    GmailReceiptCategoryService,
    GmailReceiptExportService,
    GmailMerchantReparseService,
    GmailReceiptProcessor,
    GmailScheduler,
  ],
  exports: [
    GmailOAuthService,
    GmailService,
    GmailWatchService,
    GmailSyncService,
    GmailReceiptParserService,
    GmailReceiptDuplicateService,
    GmailReceiptCategoryService,
  ],
})
export class GmailModule {}
