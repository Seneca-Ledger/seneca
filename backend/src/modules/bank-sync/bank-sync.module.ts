import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { fetchPublicUrl } from '../../common/utils/egress-url.util';
import { Integration, OpenProtocolSettings, Transaction, Wallet } from '../../entities';
import { StatementsModule } from '../statements/statements.module';
import { BankSyncController } from './bank-sync.controller';
import { BankSyncService } from './bank-sync.service';
import { BANK_SYNC_FETCH } from './bank-sync-provider.interface';
import { SimpleFinProvider } from './simplefin.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([Integration, OpenProtocolSettings, Transaction, Wallet]),
    StatementsModule,
  ],
  controllers: [BankSyncController],
  providers: [
    BankSyncService,
    SimpleFinProvider,
    { provide: BANK_SYNC_FETCH, useValue: fetchPublicUrl },
  ],
  exports: [BankSyncService],
})
export class BankSyncModule {}
