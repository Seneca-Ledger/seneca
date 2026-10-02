import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { fetchPublicUrl } from '../../common/utils/egress-url.util';
import { Integration, OpenProtocolSettings, Transaction, Wallet } from '../../entities';
import { ImportModule } from '../import/import.module';
import { StatementsModule } from '../statements/statements.module';
import { BankSyncController } from './bank-sync.controller';
import { BankSyncService } from './bank-sync.service';
import { BANK_SYNC_FETCH, BANK_SYNC_PROVIDERS } from './bank-sync-provider.interface';
import { BankSyncPullService } from './bank-sync-pull.service';
import { SimpleFinProvider } from './simplefin.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([Integration, OpenProtocolSettings, Transaction, Wallet]),
    StatementsModule,
    ImportModule,
  ],
  controllers: [BankSyncController],
  providers: [
    BankSyncService,
    BankSyncPullService,
    SimpleFinProvider,
    { provide: BANK_SYNC_FETCH, useValue: fetchPublicUrl },
    {
      provide: BANK_SYNC_PROVIDERS,
      useFactory: (simplefin: SimpleFinProvider) => [simplefin],
      inject: [SimpleFinProvider],
    },
  ],
  exports: [BankSyncService, BankSyncPullService],
})
export class BankSyncModule {}
