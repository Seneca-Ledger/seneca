import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../../entities/category.entity';
import { Payable } from '../../entities/payable.entity';
import { PayablePayment } from '../../entities/payable-payment.entity';
import { Statement } from '../../entities/statement.entity';
import { Transaction } from '../../entities/transaction.entity';
import { Wallet } from '../../entities/wallet.entity';
import { Workspace } from '../../entities/workspace.entity';
import { AuditModule } from '../audit/audit.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WorkspaceCurrencyModule } from '../workspaces/workspace-currency.module';
import { PayablesController } from './payables.controller';
import { PayablesScheduler } from './payables.scheduler';
import { PayablesService } from './payables.service';
import { PayablesExportService } from './payables-export.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Payable,
      PayablePayment,
      Transaction,
      Statement,
      Workspace,
      Wallet,
      Category,
    ]),
    AuditModule,
    ExchangeRatesModule,
    NotificationsModule,
    WorkspaceCurrencyModule,
  ],
  controllers: [PayablesController],
  providers: [PayablesService, PayablesExportService, PayablesScheduler],
  exports: [PayablesService],
})
export class PayablesModule {}
