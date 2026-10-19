import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExchangeRate } from '../../entities/exchange-rate.entity';
import { Transaction } from '../../entities/transaction.entity';
import { Workspace } from '../../entities/workspace.entity';
import { WorkspaceExchangeRate } from '../../entities/workspace-exchange-rate.entity';
import { ExchangeRatesController } from './exchange-rates.controller';
import { ExchangeRatesService } from './exchange-rates.service';
import { ExchangeRatesSyncService } from './exchange-rates-sync.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExchangeRate, Transaction, Workspace, WorkspaceExchangeRate]),
  ],
  controllers: [ExchangeRatesController],
  providers: [ExchangeRatesService, ExchangeRatesSyncService],
  exports: [ExchangeRatesService],
})
export class ExchangeRatesModule {}
