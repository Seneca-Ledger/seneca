import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../../entities/client.entity';
import { Invoice } from '../../entities/invoice.entity';
import { Payable } from '../../entities/payable.entity';
import { Transaction } from '../../entities/transaction.entity';
import { Workspace } from '../../entities/workspace.entity';
import { AuditModule } from '../audit/audit.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { MailerModule } from '../mailer/mailer.module';
import { PayablesModule } from '../payables/payables.module';
import { InvoiceRemindersController, ReconciliationController } from './smb.controller';
import { SmbService } from './smb.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payable, Transaction, Invoice, Client, Workspace]),
    PayablesModule,
    MailerModule,
    ExchangeRatesModule,
    AuditModule,
  ],
  controllers: [ReconciliationController, InvoiceRemindersController],
  providers: [SmbService],
  exports: [SmbService],
})
export class SmbModule {}
