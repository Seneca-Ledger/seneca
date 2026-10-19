import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdempotencyService } from '../../common/services/idempotency.service';
import {
  Branch,
  Category,
  CryptoWallet,
  IdempotencyKey,
  JournalEntry,
  JournalLine,
  LedgerAccount,
  LedgerCounter,
  Payable,
  Statement,
  Transaction,
  Wallet,
  Workspace,
} from '../../entities';
import { AuditModule } from '../audit/audit.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { LedgerController } from './ledger.controller';
import { LedgerAccountsService } from './ledger-accounts.service';
import { LedgerEntriesController } from './ledger-entries.controller';
import { LedgerEntriesService } from './ledger-entries.service';
import { LedgerPostingService } from './ledger-posting.service';
import { LedgerReportsController } from './ledger-reports.controller';
import { LedgerReportsService } from './ledger-reports.service';
import { LedgerRevaluationService } from './ledger-revaluation.service';
import { LedgerRevaluationsController } from './ledger-revaluations.controller';
import { LedgerSettingsController } from './ledger-settings.controller';
import { LedgerSyncService } from './ledger-sync.service';
import { LedgerSyncProcessor, LedgerSyncSweeper } from './queue/ledger-sync.processor';
import { LEDGER_SYNC_QUEUE, LedgerSyncQueue } from './queue/ledger-sync.queue';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LedgerAccount,
      JournalEntry,
      JournalLine,
      LedgerCounter,
      Category,
      Transaction,
      Statement,
      Wallet,
      CryptoWallet,
      Workspace,
      Branch,
      IdempotencyKey,
      Payable,
    ]),
    BullModule.registerQueue({ name: LEDGER_SYNC_QUEUE }),
    ExchangeRatesModule,
    AuditModule,
  ],
  controllers: [
    LedgerController,
    LedgerEntriesController,
    LedgerSettingsController,
    LedgerReportsController,
    LedgerRevaluationsController,
  ],
  providers: [
    LedgerAccountsService,
    LedgerPostingService,
    LedgerEntriesService,
    LedgerSyncService,
    LedgerReportsService,
    LedgerRevaluationService,
    LedgerSyncQueue,
    LedgerSyncProcessor,
    LedgerSyncSweeper,
    IdempotencyService,
  ],
  exports: [LedgerAccountsService, LedgerPostingService, LedgerSyncService],
})
export class LedgerModule {}
