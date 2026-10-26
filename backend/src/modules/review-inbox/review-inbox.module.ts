import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Receipt } from '../../entities/receipt.entity';
import { Statement } from '../../entities/statement.entity';
import { Subscription } from '../../entities/subscription.entity';
import { Transaction } from '../../entities/transaction.entity';
import { Workspace } from '../../entities/workspace.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { ReviewInboxController } from './review-inbox.controller';
import { ReviewInboxScheduler } from './review-inbox.scheduler';
import { ReviewInboxService } from './review-inbox.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, Receipt, Subscription, Statement, Workspace]),
    TransactionsModule,
    NotificationsModule,
  ],
  controllers: [ReviewInboxController],
  providers: [ReviewInboxService, ReviewInboxScheduler],
  exports: [ReviewInboxService],
})
export class ReviewInboxModule {}
