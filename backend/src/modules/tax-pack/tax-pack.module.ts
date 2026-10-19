import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileStorageService } from '../../common/services/file-storage.service';
import { Receipt } from '../../entities/receipt.entity';
import { Statement } from '../../entities/statement.entity';
import { Transaction } from '../../entities/transaction.entity';
import { TransactionAttachment } from '../../entities/transaction-attachment.entity';
import { Workspace } from '../../entities/workspace.entity';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { TaxPackController } from './tax-pack.controller';
import { TaxPackService } from './tax-pack.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, TransactionAttachment, Receipt, Statement, Workspace]),
    ExchangeRatesModule,
  ],
  controllers: [TaxPackController],
  providers: [TaxPackService, FileStorageService],
  exports: [TaxPackService],
})
export class TaxPackModule {}
