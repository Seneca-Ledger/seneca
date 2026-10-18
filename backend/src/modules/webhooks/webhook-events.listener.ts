import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type {
  BudgetExceededEvent,
  ImportCommittedEvent,
  ImportFailedEvent,
  ParsingErrorEvent,
  PayableOverdueEvent,
  PayablePaidEvent,
  ReceiptApprovedEvent,
  ReceiptNeedsReviewEvent,
  StatementUploadedEvent,
  TaxDeadlineUpcomingEvent,
  TaxThresholdReachedEvent,
  TransactionCreatedEvent,
  TransactionsImportedEvent,
  TransactionsUncategorizedEvent,
} from '../notifications/events/notification-events';
import { WebhookDispatcherService } from './services/webhook-dispatcher.service';
import * as payloads from './webhook-payloads';

/** Turns what happens in the app into outbound webhook deliveries. */
@Injectable()
export class WebhookEventsListener {
  private readonly logger = new Logger(WebhookEventsListener.name);

  constructor(private readonly dispatcher: WebhookDispatcherService) {}

  /** A failed dispatch is logged; the action that raised the event already happened. */
  private async send(message: payloads.WebhookMessage): Promise<void> {
    try {
      await this.dispatcher.dispatch(message.workspaceId, message.event, message.body);
    } catch (err) {
      this.logger.error(`Failed to dispatch ${message.event} webhook`, err);
    }
  }

  @OnEvent('import.committed')
  async onImportCommitted(event: ImportCommittedEvent): Promise<void> {
    await this.send(payloads.statementProcessed(event));
    if (event.transactionIds?.length) {
      await this.send(
        payloads.transactionsImported({
          workspaceId: event.workspaceId,
          source: event.source ?? 'statement',
          statementId: event.statementId,
          transactionIds: event.transactionIds,
        }),
      );
    }
  }

  @OnEvent('transactions.imported')
  async onTransactionsImported(event: TransactionsImportedEvent): Promise<void> {
    await this.send(payloads.transactionsImported(event));
  }

  @OnEvent('transaction.created')
  async onTransactionCreated(event: TransactionCreatedEvent): Promise<void> {
    await this.send(payloads.transactionCreated(event));
  }

  @OnEvent('statement.uploaded')
  async onStatementUploaded(event: StatementUploadedEvent): Promise<void> {
    await this.send(payloads.statementUploaded(event));
  }

  @OnEvent('parsing.error')
  async onParsingError(event: ParsingErrorEvent): Promise<void> {
    await this.send(payloads.statementFailed(event, 'parsing'));
  }

  @OnEvent('import.failed')
  async onImportFailed(event: ImportFailedEvent): Promise<void> {
    await this.send(payloads.statementFailed(event, 'import'));
  }

  @OnEvent('transactions.uncategorized')
  async onTransactionsUncategorized(event: TransactionsUncategorizedEvent): Promise<void> {
    await this.send(payloads.transactionsUncategorized(event));
  }

  @OnEvent('receipt.approved')
  async onReceiptApproved(event: ReceiptApprovedEvent): Promise<void> {
    await this.send(payloads.receiptApproved(event));
  }

  @OnEvent('receipt.needs_review')
  async onReceiptNeedsReview(event: ReceiptNeedsReviewEvent): Promise<void> {
    await this.send(payloads.receiptNeedsReview(event));
  }

  @OnEvent('payable.paid')
  async onPayablePaid(event: PayablePaidEvent): Promise<void> {
    await this.send(payloads.payablePaid(event));
  }

  @OnEvent('payable.overdue')
  async onPayableOverdue(event: PayableOverdueEvent): Promise<void> {
    await this.send(payloads.payableOverdue(event));
  }

  @OnEvent('budget.exceeded')
  async onBudgetExceeded(event: BudgetExceededEvent): Promise<void> {
    await this.send(payloads.budgetExceeded(event));
  }

  @OnEvent('tax.deadline.upcoming')
  async onTaxDeadlineUpcoming(event: TaxDeadlineUpcomingEvent): Promise<void> {
    await this.send(payloads.taxDeadlineUpcoming(event));
  }

  @OnEvent('tax.threshold.reached')
  async onTaxThresholdReached(event: TaxThresholdReachedEvent): Promise<void> {
    await this.send(payloads.taxThresholdReached(event));
  }
}
