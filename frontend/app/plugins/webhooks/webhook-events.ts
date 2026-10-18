import { WEBHOOK_EVENT_GROUPS, type WebhookEventName } from '@/app/lib/contracts';

export { WEBHOOK_EVENT_GROUPS };
export type WebhookEventGroup = keyof typeof WEBHOOK_EVENT_GROUPS;

/** Dictionary key of each event's label; a new event without one fails to compile. */
export const EVENT_LABEL_KEY = {
  'transaction.created': 'transactionCreated',
  'transactions.imported': 'transactionsImported',
  'statement.uploaded': 'statementUploaded',
  'statement.processed': 'statementProcessed',
  'statement.failed': 'statementFailed',
  'transactions.uncategorized': 'transactionsUncategorized',
  'receipt.approved': 'receiptApproved',
  'receipt.needs_review': 'receiptNeedsReview',
  'invoice.paid': 'invoicePaid',
  'invoice.overdue': 'invoiceOverdue',
  'bill.paid': 'billPaid',
  'bill.overdue': 'billOverdue',
  'budget.exceeded': 'budgetExceeded',
  'tax.deadline.upcoming': 'taxDeadlineUpcoming',
  'tax.threshold.reached': 'taxThresholdReached',
} as const satisfies Record<WebhookEventName, string>;

export const isWebhookEventName = (value: string): value is WebhookEventName =>
  value in EVENT_LABEL_KEY;
