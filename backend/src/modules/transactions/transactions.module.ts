import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User, WorkspaceMember } from '../../entities';
import { Category } from '../../entities/category.entity';
import { Payee } from '../../entities/payee.entity';
import { Statement } from '../../entities/statement.entity';
import { Tag } from '../../entities/tag.entity';
import { Transaction } from '../../entities/transaction.entity';
import { TransactionAttachment } from '../../entities/transaction-attachment.entity';
import { Wallet } from '../../entities/wallet.entity';
import { AuditModule } from '../audit/audit.module';
import { ClassificationModule } from '../classification/classification.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { PayeesModule } from '../payees/payees.module';
import { TaxModule } from '../tax/tax.module';
import { CrossStatementDeduplicationService } from './services/cross-statement-deduplication.service';
import { ManualRowDuplicateService } from './services/manual-row-duplicate.service';
import { TransactionAttachmentsService } from './services/transaction-attachments.service';
import { TransactionFingerprintService } from './services/transaction-fingerprint.service';
import { TransactionHistoryService } from './services/transaction-history.service';
import { TransactionTagsService } from './services/transaction-tags.service';
import { TransactionsOverviewService } from './services/transactions-overview.service';
import { TransferPairingService } from './services/transfer-pairing.service';
import { TransferToAccountService } from './services/transfer-to-account.service';
import { TransactionHistoryController } from './transaction-history.controller';
import { TransactionPairingController } from './transaction-pairing.controller';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transaction,
      Statement,
      User,
      WorkspaceMember,
      Category,
      Tag,
      TransactionAttachment,
      Wallet,
      Payee,
    ]),
    AuditModule,
    ClassificationModule,
    ExchangeRatesModule,
    TaxModule,
    PayeesModule,
  ],
  controllers: [TransactionsController, TransactionPairingController, TransactionHistoryController],
  providers: [
    TransactionsService,
    CrossStatementDeduplicationService,
    ManualRowDuplicateService,
    TransactionFingerprintService,
    TransactionTagsService,
    TransactionAttachmentsService,
    TransferPairingService,
    TransferToAccountService,
    TransactionsOverviewService,
    TransactionHistoryService,
  ],
  exports: [
    TransactionsService,
    CrossStatementDeduplicationService,
    ManualRowDuplicateService,
    TransactionFingerprintService,
    TransferPairingService,
    TransactionAttachmentsService,
  ],
})
export class TransactionsModule {}
