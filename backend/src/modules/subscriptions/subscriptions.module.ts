import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Budget } from '../../entities/budget.entity';
import { Category } from '../../entities/category.entity';
import { Invoice } from '../../entities/invoice.entity';
import { Payable } from '../../entities/payable.entity';
import { Subscription } from '../../entities/subscription.entity';
import { SubscriptionCharge } from '../../entities/subscription-charge.entity';
import { SubscriptionDecision } from '../../entities/subscription-decision.entity';
import { SubscriptionPayee } from '../../entities/subscription-payee.entity';
import { Transaction } from '../../entities/transaction.entity';
import { Workspace } from '../../entities/workspace.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { AuditModule } from '../audit/audit.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { GoalsModule } from '../goals/goals.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TaxModule } from '../tax/tax.module';
import { SubscriptionAutoLinkSubscriber } from './subscription-autolink.subscriber';
import { SubscriptionDetectionService } from './subscription-detection.service';
import { SubscriptionEventsListener } from './subscription-events.listener';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Budget,
      Category,
      Subscription,
      SubscriptionCharge,
      SubscriptionDecision,
      SubscriptionPayee,
      Transaction,
      Workspace,
      WorkspaceMember,
      Payable,
      Invoice,
    ]),
    NotificationsModule,
    ExchangeRatesModule,
    GoalsModule,
    AuditModule,
    TaxModule,
  ],
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
    SubscriptionDetectionService,
    SubscriptionEventsListener,
    SubscriptionAutoLinkSubscriber,
  ],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
