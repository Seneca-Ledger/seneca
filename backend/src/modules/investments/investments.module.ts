import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceAccount } from '../../entities/balance-account.entity';
import { InvestmentHolding } from '../../entities/investment-holding.entity';
import { Transaction } from '../../entities/transaction.entity';
import { Workspace } from '../../entities/workspace.entity';
import { BalanceModule } from '../balance/balance.module';
import { CryptoModule } from '../crypto/crypto.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { InvestmentsController } from './investments.controller';
import { InvestmentsScheduler } from './investments.scheduler';
import { InvestmentsService } from './investments.service';
import { StockPriceService } from './stock-price.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([BalanceAccount, InvestmentHolding, Transaction, Workspace]),
    BalanceModule,
    CryptoModule,
    ExchangeRatesModule,
  ],
  controllers: [InvestmentsController],
  providers: [InvestmentsService, InvestmentsScheduler, StockPriceService],
  exports: [InvestmentsService],
})
export class InvestmentsModule {}
