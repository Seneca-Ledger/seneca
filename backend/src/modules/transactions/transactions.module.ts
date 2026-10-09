import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User, WorkspaceMember } from '../../entities';
import { Category } from '../../entities/category.entity';
import { Statement } from '../../entities/statement.entity';
import { Tag } from '../../entities/tag.entity';
import { Transaction } from '../../entities/transaction.entity';
import { TransactionAttachment } from '../../entities/transaction-attachment.entity';
import { AuditModule } from '../audit/audit.module';
import { ClassificationModule } from '../classification/classification.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { TaxModule } from '../tax/tax.module';
import { CrossStatementDeduplicationService } from './services/cross-statement-deduplication.service';
import { TransactionAttachmentsService } from './services/transaction-attachments.service';
import { TransactionFingerprintService } from './services/transaction-fingerprint.service';
import { TransactionTagsService } from './services/transaction-tags.service';
import { TransferPairingService } from './services/transfer-pairing.service';
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
    ]),
    AuditModule,
    ClassificationModule,
    ExchangeRatesModule,
    TaxModule,
  ],
  controllers: [TransactionsController],
  providers: [
    TransactionsService,
    CrossStatementDeduplicationService,
    TransactionFingerprintService,
    TransactionTagsService,
    TransactionAttachmentsService,
    TransferPairingService,
  ],
  exports: [
    TransactionsService,
    CrossStatementDeduplicationService,
    TransactionFingerprintService,
    TransferPairingService,
    TransactionAttachmentsService,
  ],
})
export class TransactionsModule {}
