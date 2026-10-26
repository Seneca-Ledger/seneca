import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  BalanceAccount,
  BalanceSnapshot,
  Statement,
  Transaction,
  Wallet,
  Workspace,
  WorkspaceMember,
} from '../../entities';
import { AuditModule } from '../audit/audit.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { BalanceController } from './balance.controller';
import { BalanceService } from './balance.service';
import { BalanceHistoryService } from './balance-history.service';
import { BalancePersonalLayoutService } from './balance-personal-layout.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BalanceAccount,
      BalanceSnapshot,
      Wallet,
      Transaction,
      Statement,
      Workspace,
      WorkspaceMember,
    ]),
    AuditModule,
    ExchangeRatesModule,
  ],
  controllers: [BalanceController],
  providers: [BalanceService, BalanceHistoryService, BalancePersonalLayoutService],
  exports: [BalanceService, BalanceHistoryService],
})
export class BalanceModule {}
