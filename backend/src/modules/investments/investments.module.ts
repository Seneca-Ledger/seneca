import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceAccount } from '../../entities/balance-account.entity';
import { InvestmentHolding } from '../../entities/investment-holding.entity';
import { MetalSale } from '../../entities/metal-sale.entity';
import { Receipt } from '../../entities/receipt.entity';
import { Transaction } from '../../entities/transaction.entity';
import { Workspace } from '../../entities/workspace.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { WorkspaceServiceSettings } from '../../entities/workspace-service-settings.entity';
import { BalanceModule } from '../balance/balance.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { InvestmentsController } from './investments.controller';
import { InvestmentsService } from './investments.service';
import { MetalsController } from './metals.controller';
import { MetalsService } from './metals.service';
import { StockPriceService } from './stock-price.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BalanceAccount,
      InvestmentHolding,
      MetalSale,
      Receipt,
      Transaction,
      Workspace,
      WorkspaceMember,
      WorkspaceServiceSettings,
    ]),
    BalanceModule,
    ExchangeRatesModule,
  ],
  controllers: [InvestmentsController, MetalsController],
  providers: [InvestmentsService, MetalsService, StockPriceService],
  exports: [InvestmentsService, MetalsService],
})
export class InvestmentsModule {}
