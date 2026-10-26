import * as Schema from 'effect/Schema';
import { WebhookEventName } from '../../../../src/contracts';
import { WebhookEvent } from '../../../../src/entities/webhook-subscription.entity';
import { WebhookEventsListener } from '../../../../src/modules/webhooks/webhook-events.listener';
import { MAX_IMPORTED_IDS } from '../../../../src/modules/webhooks/webhook-payloads';

describe('WebhookEventsListener', () => {
  let listener: WebhookEventsListener;
  const mockDispatcher = { dispatch: vi.fn() };
  const mockLogger = { error: vi.fn() };

  beforeEach(() => {
    listener = new WebhookEventsListener(mockDispatcher as any);
    (listener as any).logger = mockLogger;
    vi.clearAllMocks();
    mockDispatcher.dispatch.mockResolvedValue(undefined);
  });

  /** The body sent for `event` in the last dispatch of that event. */
  const sent = (event: WebhookEvent): Record<string, unknown> => {
    const call = mockDispatcher.dispatch.mock.calls.find(([, name]) => name === event);
    if (!call) throw new Error(`${event} was not dispatched`);
    expect(call[0]).toBe('ws-1');
    return call[2];
  };

  it('offers exactly the events the subscription contract accepts', () => {
    const decode = Schema.decodeUnknownSync(Schema.Array(WebhookEventName));
    expect(() => decode(Object.values(WebhookEvent))).not.toThrow();
    expect(() => decode(['transaction.updated'])).toThrow();
    expect(Object.values(WebhookEvent)).toHaveLength(15);
  });

  it('announces a processed statement and the rows it created', async () => {
    await listener.onImportCommitted({
      workspaceId: 'ws-1',
      actorId: 'u-1',
      actorName: 'Alice',
      statementId: 's-1',
      transactionCount: 2,
      transactionIds: ['t-1', 't-2'],
      source: 'statement',
    });

    expect(sent(WebhookEvent.STATEMENT_PROCESSED)).toMatchObject({
      event: 'statement.processed',
      workspaceId: 'ws-1',
      statementId: 's-1',
      transactionCount: 2,
      timestamp: expect.any(String),
    });
    expect(sent(WebhookEvent.TRANSACTIONS_IMPORTED)).toMatchObject({
      source: 'statement',
      statementId: 's-1',
      count: 2,
      transactionIds: ['t-1', 't-2'],
      truncated: false,
    });
  });

  it('sends no batch for an import that names no rows', async () => {
    await listener.onImportCommitted({
      workspaceId: 'ws-1',
      actorId: 'u-1',
      actorName: 'Alice',
      transactionCount: 0,
    });

    expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);
  });

  it('caps the ids of a large batch and says so', async () => {
    const ids = Array.from({ length: MAX_IMPORTED_IDS + 3 }, (_, i) => `t-${i}`);

    await listener.onTransactionsImported({ workspaceId: 'ws-1', source: 'crypto_sync', transactionIds: ids });

    const body = sent(WebhookEvent.TRANSACTIONS_IMPORTED);
    expect(body).toMatchObject({ source: 'crypto_sync', count: ids.length, truncated: true });
    expect(body.transactionIds).toHaveLength(MAX_IMPORTED_IDS);
  });

  it('sends a new transaction with its day, source and category', async () => {
    await listener.onTransactionCreated({
      workspaceId: 'ws-1',
      transactionId: 'tx-1',
      amount: 100,
      currency: 'USD',
      transactionDate: new Date('2024-01-01T00:00:00.000Z'),
      counterpartyName: 'ACME',
      transactionType: 'expense',
      source: 'manual_expense',
      statementId: 's-1',
      categoryId: 'c-1',
    });

    expect(sent(WebhookEvent.TRANSACTION_CREATED)).toMatchObject({
      transactionId: 'tx-1',
      amount: 100,
      transactionDate: '2024-01-01',
      source: 'manual_expense',
      categoryId: 'c-1',
    });
  });

  it('tells how a receipt was approved, reading an older event as created', async () => {
    await listener.onReceiptApproved({
      workspaceId: 'ws-1',
      receiptId: 'r-1',
      transactionId: 't-1',
      mode: 'attached_to_bank_row',
    });
    expect(sent(WebhookEvent.RECEIPT_APPROVED)).toMatchObject({ mode: 'attached_to_bank_row' });

    vi.clearAllMocks();
    await listener.onReceiptApproved({ workspaceId: 'ws-1', receiptId: 'r-1', transactionId: 't-1' });
    expect(sent(WebhookEvent.RECEIPT_APPROVED)).toMatchObject({ mode: 'created' });
  });

  it('splits paid and overdue by direction: invoices are owed to you, bills by you', async () => {
    const paid = {
      workspaceId: 'ws-1',
      payableId: 'p-1',
      source: 'invoice',
      vendor: 'Client',
      amount: 50,
      currency: 'EUR',
      paidAt: '2026-01-02T00:00:00.000Z',
    };
    await listener.onPayablePaid({ ...paid, direction: 'receivable' });
    await listener.onPayablePaid({ ...paid, direction: 'payable', source: 'manual' });
    const overdue = {
      workspaceId: 'ws-1',
      payableId: 'p-2',
      source: 'manual',
      vendor: 'Landlord',
      outstanding: 900,
      currency: 'EUR',
      dueDate: '2026-01-01',
    };
    await listener.onPayableOverdue({ ...overdue, direction: 'receivable' });
    await listener.onPayableOverdue({ ...overdue, direction: 'payable' });

    expect(sent(WebhookEvent.INVOICE_PAID)).toMatchObject({ payableId: 'p-1', amount: 50 });
    expect(sent(WebhookEvent.BILL_PAID)).toMatchObject({ direction: 'payable' });
    expect(sent(WebhookEvent.INVOICE_OVERDUE)).toMatchObject({ outstanding: 900 });
    expect(sent(WebhookEvent.BILL_OVERDUE)).toMatchObject({ dueDate: '2026-01-01' });
  });

  it('maps the remaining events one to one', async () => {
    await listener.onStatementUploaded({
      workspaceId: 'ws-1',
      actorId: 'u-1',
      actorName: 'A',
      statementId: 's-1',
      statementName: 'march.pdf',
    });
    await listener.onParsingError({
      workspaceId: 'ws-1',
      userId: 'u-1',
      statementId: 's-1',
      errorMessage: 'unreadable',
    });
    await listener.onTransactionsUncategorized({ workspaceId: 'ws-1', userId: 'u-1', count: 3 });
    await listener.onReceiptNeedsReview({
      workspaceId: 'ws-1',
      receiptId: 'r-1',
      source: 'scan',
      reasons: ['missing_amount'],
    });
    await listener.onBudgetExceeded({
      workspaceId: 'ws-1',
      budgetId: 'b-1',
      name: 'Food',
      categoryId: 'c-1',
      limitAmount: 100,
      spentAmount: 120,
      percentUsed: 120,
      currency: 'EUR',
    });
    await listener.onTaxDeadlineUpcoming({
      workspaceId: 'ws-1',
      kind: 'vat_return',
      periodStart: '2026-01-01',
      periodEnd: '2026-03-31',
      dueDate: '2026-04-10',
      daysLeft: 7,
      returnName: 'UStVA Q1',
    } as any);
    await listener.onTaxThresholdReached({
      workspaceId: 'ws-1',
      level: 80,
      turnover: 20000,
      threshold: 25000,
      currency: 'EUR',
      percentUsed: 80,
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
    } as any);

    expect(sent(WebhookEvent.STATEMENT_UPLOADED)).toMatchObject({ statementName: 'march.pdf' });
    expect(sent(WebhookEvent.STATEMENT_FAILED)).toMatchObject({ stage: 'parsing', errorMessage: 'unreadable' });
    expect(sent(WebhookEvent.TRANSACTIONS_UNCATEGORIZED)).toMatchObject({ count: 3 });
    expect(sent(WebhookEvent.RECEIPT_NEEDS_REVIEW)).toMatchObject({ reasons: ['missing_amount'] });
    expect(sent(WebhookEvent.BUDGET_EXCEEDED)).toMatchObject({ percentUsed: 120, spentAmount: 120 });
    expect(sent(WebhookEvent.TAX_DEADLINE_UPCOMING)).toMatchObject({ daysLeft: 7 });
    expect(sent(WebhookEvent.TAX_THRESHOLD_REACHED)).toMatchObject({ level: 80 });
  });

  it('labels a failed import as the import stage', async () => {
    await listener.onImportFailed({ workspaceId: 'ws-1', userId: 'u-1', errorMessage: 'rolled back' });

    expect(sent(WebhookEvent.STATEMENT_FAILED)).toMatchObject({ stage: 'import' });
  });

  it('catches and logs errors instead of rethrowing', async () => {
    mockDispatcher.dispatch.mockRejectedValue(new Error('DB down'));

    await expect(
      listener.onImportCommitted({ workspaceId: 'ws-1', actorId: 'u', actorName: 'A', transactionCount: 1 }),
    ).resolves.toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalled();
  });
});
