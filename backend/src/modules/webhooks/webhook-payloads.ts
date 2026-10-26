import { WebhookEvent } from '../../entities/webhook-subscription.entity';
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

/**
 * What a subscriber receives, one builder per event. Every body is flat JSON
 * with `event`, `workspaceId` and `timestamp`; the fields after them are the
 * event's own and are documented in the webhooks guide.
 */
export interface WebhookMessage {
  event: WebhookEvent;
  workspaceId: string;
  body: Record<string, unknown>;
}

/** A batch announces at most this many ids; the rest are read by statement or listed. */
export const MAX_IMPORTED_IDS = 500;

const message = (
  event: WebhookEvent,
  workspaceId: string,
  fields: Record<string, unknown>,
): WebhookMessage => ({
  event,
  workspaceId,
  body: { event, workspaceId, ...fields, timestamp: new Date().toISOString() },
});

const isoDay = (value: Date | string): string =>
  (value instanceof Date ? value.toISOString() : String(value)).slice(0, 10);

export const transactionCreated = (event: TransactionCreatedEvent): WebhookMessage =>
  message(WebhookEvent.TRANSACTION_CREATED, event.workspaceId, {
    transactionId: event.transactionId,
    amount: event.amount,
    currency: event.currency,
    transactionDate: isoDay(event.transactionDate),
    counterpartyName: event.counterpartyName,
    transactionType: event.transactionType,
    source: event.source ?? null,
    statementId: event.statementId ?? null,
    categoryId: event.categoryId ?? null,
  });

export const transactionsImported = (
  event: Pick<
    TransactionsImportedEvent,
    'workspaceId' | 'source' | 'statementId' | 'transactionIds'
  >,
): WebhookMessage =>
  message(WebhookEvent.TRANSACTIONS_IMPORTED, event.workspaceId, {
    source: event.source,
    statementId: event.statementId ?? null,
    count: event.transactionIds.length,
    transactionIds: event.transactionIds.slice(0, MAX_IMPORTED_IDS),
    truncated: event.transactionIds.length > MAX_IMPORTED_IDS,
  });

export const statementProcessed = (event: ImportCommittedEvent): WebhookMessage =>
  message(WebhookEvent.STATEMENT_PROCESSED, event.workspaceId, {
    statementId: event.statementId,
    transactionCount: event.transactionCount,
  });

export const statementUploaded = (event: StatementUploadedEvent): WebhookMessage =>
  message(WebhookEvent.STATEMENT_UPLOADED, event.workspaceId, {
    statementId: event.statementId,
    statementName: event.statementName,
    bankName: event.bankName ?? null,
  });

export const statementFailed = (
  event: ParsingErrorEvent | ImportFailedEvent,
  stage: 'parsing' | 'import',
): WebhookMessage =>
  message(WebhookEvent.STATEMENT_FAILED, event.workspaceId, {
    statementId: event.statementId ?? null,
    statementName: event.statementName ?? null,
    stage,
    errorMessage: event.errorMessage,
  });

export const transactionsUncategorized = (event: TransactionsUncategorizedEvent): WebhookMessage =>
  message(WebhookEvent.TRANSACTIONS_UNCATEGORIZED, event.workspaceId, {
    statementId: event.statementId ?? null,
    count: event.count,
  });

export const receiptApproved = (event: ReceiptApprovedEvent): WebhookMessage =>
  message(WebhookEvent.RECEIPT_APPROVED, event.workspaceId, {
    receiptId: event.receiptId,
    transactionId: event.transactionId,
    mode: event.mode ?? 'created',
  });

export const receiptNeedsReview = (event: ReceiptNeedsReviewEvent): WebhookMessage =>
  message(WebhookEvent.RECEIPT_NEEDS_REVIEW, event.workspaceId, {
    receiptId: event.receiptId,
    source: event.source,
    reasons: event.reasons,
  });

/** Money owed to the workspace is an invoice; money it owes is a bill. */
export const payablePaid = (event: PayablePaidEvent): WebhookMessage =>
  message(
    event.direction === 'receivable' ? WebhookEvent.INVOICE_PAID : WebhookEvent.BILL_PAID,
    event.workspaceId,
    {
      payableId: event.payableId,
      direction: event.direction,
      source: event.source,
      vendor: event.vendor,
      amount: event.amount,
      currency: event.currency,
      paidAt: event.paidAt,
    },
  );

export const payableOverdue = (event: PayableOverdueEvent): WebhookMessage =>
  message(
    event.direction === 'receivable' ? WebhookEvent.INVOICE_OVERDUE : WebhookEvent.BILL_OVERDUE,
    event.workspaceId,
    {
      payableId: event.payableId,
      direction: event.direction,
      source: event.source,
      vendor: event.vendor,
      outstanding: event.outstanding,
      currency: event.currency,
      dueDate: event.dueDate,
    },
  );

export const budgetExceeded = (event: BudgetExceededEvent): WebhookMessage =>
  message(WebhookEvent.BUDGET_EXCEEDED, event.workspaceId, {
    budgetId: event.budgetId,
    name: event.name,
    categoryId: event.categoryId,
    limitAmount: event.limitAmount,
    spentAmount: event.spentAmount,
    percentUsed: event.percentUsed,
    currency: event.currency,
  });

export const taxDeadlineUpcoming = (event: TaxDeadlineUpcomingEvent): WebhookMessage =>
  message(WebhookEvent.TAX_DEADLINE_UPCOMING, event.workspaceId, {
    kind: event.kind,
    returnName: event.returnName,
    periodStart: event.periodStart,
    periodEnd: event.periodEnd,
    dueDate: event.dueDate,
    daysLeft: event.daysLeft,
  });

export const taxThresholdReached = (event: TaxThresholdReachedEvent): WebhookMessage =>
  message(WebhookEvent.TAX_THRESHOLD_REACHED, event.workspaceId, {
    level: event.level,
    turnover: event.turnover,
    threshold: event.threshold,
    currency: event.currency,
    percentUsed: event.percentUsed,
    periodStart: event.periodStart,
    periodEnd: event.periodEnd,
  });
