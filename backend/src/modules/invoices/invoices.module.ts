import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../../entities/client.entity';
import { CreditNote } from '../../entities/credit-note.entity';
import { CreditNoteApplication } from '../../entities/credit-note-application.entity';
import { CreditNoteLineItem } from '../../entities/credit-note-line-item.entity';
import { Invoice } from '../../entities/invoice.entity';
import { InvoiceCounter } from '../../entities/invoice-counter.entity';
import { InvoiceDelivery } from '../../entities/invoice-delivery.entity';
import { InvoiceLineItem } from '../../entities/invoice-line-item.entity';
import { InvoiceSettings } from '../../entities/invoice-settings.entity';
import { Payable } from '../../entities/payable.entity';
import { BusinessProfileModule } from '../business-profile/business-profile.module';
import { LedgerModule } from '../ledger/ledger.module';
import { MailerModule } from '../mailer/mailer.module';
import { PayablesModule } from '../payables/payables.module';
import { WorkspaceCurrencyModule } from '../workspaces/workspace-currency.module';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { CreditNotesController } from './credit-notes.controller';
import { CreditNotesService } from './credit-notes.service';
import { InvoiceAgeingService } from './invoice-ageing.service';
import { InvoiceDeliveryService } from './invoice-delivery.service';
import { InvoiceRemindersService } from './invoice-reminders.service';
import { InvoiceSettingsService } from './invoice-settings.service';
import { InvoicesController } from './invoices.controller';
import { InvoicesScheduler } from './invoices.scheduler';
import { InvoicesService } from './invoices.service';
import { PublicInvoicesController } from './public-invoices.controller';
import { PublicInvoicesService } from './public-invoices.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Invoice,
      InvoiceLineItem,
      InvoiceCounter,
      InvoiceDelivery,
      InvoiceSettings,
      CreditNote,
      CreditNoteLineItem,
      CreditNoteApplication,
      Client,
      Payable,
    ]),
    LedgerModule,
    BusinessProfileModule,
    PayablesModule,
    MailerModule,
    WorkspaceCurrencyModule,
  ],
  controllers: [
    InvoicesController,
    ClientsController,
    CreditNotesController,
    PublicInvoicesController,
  ],
  providers: [
    InvoicesService,
    CreditNotesService,
    InvoiceAgeingService,
    InvoiceDeliveryService,
    InvoiceRemindersService,
    InvoiceSettingsService,
    PublicInvoicesService,
    ClientsService,
    InvoicesScheduler,
  ],
  exports: [
    InvoicesService,
    CreditNotesService,
    InvoiceAgeingService,
    InvoiceDeliveryService,
    InvoiceRemindersService,
    InvoiceSettingsService,
    ClientsService,
  ],
})
export class InvoicesModule {}
