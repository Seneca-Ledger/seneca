import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceAccount } from '../../entities/balance-account.entity';
import { BalanceSnapshot } from '../../entities/balance-snapshot.entity';
import { CryptoWallet } from '../../entities/crypto-wallet.entity';
import { ExchangeRate } from '../../entities/exchange-rate.entity';
import { Transaction } from '../../entities/transaction.entity';
import { Workspace } from '../../entities/workspace.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { AuditModule } from '../audit/audit.module';
import { BalanceModule } from '../balance/balance.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { BitcoinClient } from './bitcoin.client';
import { CryptoController } from './crypto.controller';
import { CryptoService } from './crypto.service';
import { CryptoBalanceService } from './crypto-balance.service';
import { CryptoHoldingsService } from './crypto-holdings.service';
import { CryptoIconsService } from './crypto-icons.service';
import { CryptoImportService } from './crypto-import.service';
import { CryptoPriceService } from './crypto-price.service';
import { CryptoSyncService } from './crypto-sync.service';
import { SolanaRpcClient } from './solana-rpc.client';
import { TronGridClient } from './tron-grid.client';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CryptoWallet,
      Transaction,
      Workspace,
      WorkspaceMember,
      ExchangeRate,
      BalanceAccount,
      BalanceSnapshot,
    ]),
    AuditModule,
    BalanceModule,
    ExchangeRatesModule,
    TransactionsModule,
  ],
  controllers: [CryptoController],
  providers: [
    CryptoService,
    CryptoSyncService,
    CryptoPriceService,
    CryptoHoldingsService,
    CryptoBalanceService,
    CryptoImportService,
    CryptoIconsService,
    TronGridClient,
    BitcoinClient,
    SolanaRpcClient,
  ],
  exports: [CryptoService, CryptoPriceService, CryptoHoldingsService],
})
export class CryptoModule {}
