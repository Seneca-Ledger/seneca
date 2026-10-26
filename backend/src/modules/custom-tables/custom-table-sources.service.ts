import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { Invoice } from '../../entities/invoice.entity';
import { Payable } from '../../entities/payable.entity';
import { Subscription } from '../../entities/subscription.entity';
import { Transaction } from '../../entities/transaction.entity';
import { BudgetsService } from '../budgets/budgets.service';
import { BudgetsSource } from './sources/budgets.source';
import { InvoicesSource } from './sources/invoices.source';
import { PayablesSource } from './sources/payables.source';
import type { CustomTableSourceKind, SourceAdapter } from './sources/source.types';
import { SubscriptionsSource } from './sources/subscriptions.source';
import { TransactionsSource } from './sources/transactions.source';

/** Registry of app data a custom table can be filled from. */
@Injectable()
export class CustomTableSourcesService {
  private readonly adapters: Record<CustomTableSourceKind, SourceAdapter>;

  constructor(
    @InjectRepository(Transaction) transactionRepository: Repository<Transaction>,
    @InjectRepository(Subscription) subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Payable) payableRepository: Repository<Payable>,
    @InjectRepository(Invoice) invoiceRepository: Repository<Invoice>,
    budgetsService: BudgetsService,
  ) {
    this.adapters = {
      transactions: new TransactionsSource(transactionRepository),
      subscriptions: new SubscriptionsSource(subscriptionRepository),
      payables: new PayablesSource(payableRepository),
      invoices: new InvoicesSource(invoiceRepository),
      budgets: new BudgetsSource(budgetsService),
    };
  }

  get(kind: string): SourceAdapter {
    const adapter = this.adapters[kind as CustomTableSourceKind];
    if (!adapter) {
      throw new BadRequestException(appError('SOURCE_KIND_UNKNOWN'));
    }
    return adapter;
  }
}
