import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdempotencyKey } from '../../entities/idempotency-key.entity';
import { TelegramReport } from '../../entities/telegram-report.entity';
import { Transaction } from '../../entities/transaction.entity';
import { User } from '../../entities/user.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { ApplicationSettingsModule } from '../application-settings/application-settings.module';
import { AuditModule } from '../audit/audit.module';
import { ClassificationModule } from '../classification/classification.module';
import { GoalsModule } from '../goals/goals.module';
import { InsightsModule } from '../insights/insights.module';
import { NetWorthModule } from '../net-worth/net-worth.module';
import { ReceiptsModule } from '../receipts/receipts.module';
import { ReportsModule } from '../reports/reports.module';
import { StatementsModule } from '../statements/statements.module';
import { TelegramController } from './telegram.controller';
import { TelegramScheduler } from './telegram.scheduler';
import { TelegramService } from './telegram.service';
import { TelegramBotWebhookGuard } from './telegram-bot-webhook.guard';
import { TelegramBotsService } from './telegram-bots.service';
import { TelegramLinkCodes } from './telegram-link-codes';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramWebhookGuard } from './telegram-webhook.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([TelegramReport, User, WorkspaceMember, Transaction, IdempotencyKey]),
    ApplicationSettingsModule,
    ReportsModule,
    StatementsModule,
    ReceiptsModule,
    ClassificationModule,
    AuditModule,
    GoalsModule,
    NetWorthModule,
    InsightsModule,
  ],
  controllers: [TelegramController, TelegramWebhookController],
  providers: [
    TelegramService,
    TelegramScheduler,
    TelegramWebhookGuard,
    TelegramBotWebhookGuard,
    TelegramBotsService,
    TelegramLinkCodes,
  ],
  exports: [TelegramService],
})
export class TelegramModule {}
