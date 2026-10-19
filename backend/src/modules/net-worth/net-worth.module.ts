import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceAccount, BalanceSnapshot, Transaction, Workspace } from '../../entities';
import { BalanceModule } from '../balance/balance.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { InvestmentsModule } from '../investments/investments.module';
import { NetWorthController } from './net-worth.controller';
import { NetWorthService } from './net-worth.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([BalanceAccount, BalanceSnapshot, Transaction, Workspace]),
    BalanceModule,
    ExchangeRatesModule,
    InvestmentsModule,
  ],
  controllers: [NetWorthController],
  providers: [NetWorthService],
  exports: [NetWorthService],
})
export class NetWorthModule {}
