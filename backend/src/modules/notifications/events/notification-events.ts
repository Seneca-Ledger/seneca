import type { Transaction } from '../../../entities/transaction.entity';

export interface WorkspaceActorEvent {
  workspaceId: string;
  actorId: string;
  actorName: string;
}

export interface StatementUploadedEvent extends WorkspaceActorEvent {
  statementId: string;
  statementName: string;
  bankName?: string;
}

export interface ImportCommittedEvent extends WorkspaceActorEvent {
  statementId?: string;
  transactionCount: number;
  /** The rows this import created, duplicates left out (absent from older emitters). */
  transactionIds?: string[];
  source?: TransactionsImportSource;
}

/** Where a batch of new transactions came from. */
export type TransactionsImportSource =
  | 'statement'
  | 'import_session'
  | 'custom_table'
  | 'entity_import'
  | 'crypto_sync'
  | 'crypto_import';

/**
 * Transactions created in bulk outside a statement import: a custom table
 * turned into a statement, an entity import, a crypto wallet sync. Statement
 * imports announce theirs through `import.committed`.
 */
export interface TransactionsImportedEvent {
  workspaceId: string;
  source: TransactionsImportSource;
  statementId?: string;
  transactionIds: string[];
}

export interface CategoryChangedEvent extends WorkspaceActorEvent {
  action: 'created' | 'updated' | 'deleted';
  categoryId: string;
  categoryName: string;
}

export interface MemberInvitedEvent extends WorkspaceActorEvent {
  invitedEmail: string;
  role: string;
}

export interface NoteMentionedEvent extends WorkspaceActorEvent {
  noteId: string;
  /** Any `NoteEntityType`; the notification only uses it to build a link. */
  entityType: string;
  entityId: string;
  /** Начало заметки — весь текст в уведомление не кладём. */
  excerpt: string;
  mentionedUserIds: string[];
}

export interface MemberJoinedEvent {
  workspaceId: string;
  memberId: string;
  memberName: string;
}

export interface DataDeletedEvent extends WorkspaceActorEvent {
  entityType: string;
  entityLabel?: string;
  count: number;
}

export interface WorkspaceUpdatedEvent extends WorkspaceActorEvent {
  changedFields: string[];
}

export interface ParsingErrorEvent {
  workspaceId: string;
  userId: string;
  statementId?: string;
  statementName?: string;
  errorMessage: string;
}

export interface ImportFailedEvent {
  workspaceId: string;
  userId: string;
  statementId?: string;
  statementName?: string;
  errorMessage: string;
}

export interface TransactionsUncategorizedEvent {
  workspaceId: string;
  userId: string;
  statementId?: string;
  count: number;
}

export interface ReceiptUncategorizedEvent {
  workspaceId: string;
  userId: string;
  receiptId?: string;
  receiptName?: string;
}

export interface ReceiptApprovedEvent {
  workspaceId: string;
  receiptId: string;
  transactionId: string;
  /**
   * created: a new transaction was booked for it; attached_to_bank_row: it now
   * documents an existing bank row; confirmed_scan: the row its scan booked
   * was confirmed. Absent from emitters that predate it (read as created).
   */
  mode?: 'created' | 'attached_to_bank_row' | 'confirmed_scan';
}

/** A receipt was read and needs a person: no amount found, or it may be a duplicate. */
export interface ReceiptNeedsReviewEvent {
  workspaceId: string;
  receiptId: string;
  source: string;
  reasons: string[];
}

/** Where a single new transaction came from. */
export type TransactionCreatedSource =
  | 'manual_expense'
  | 'receipt_scan'
  | 'receipt_approval'
  | 'payment'
  | 'dropped_sample';

export interface TransactionCreatedEvent {
  workspaceId: string;
  transactionId: string;
  amount: number | null;
  currency: string;
  transactionDate: Date;
  counterpartyName: string;
  transactionType: string;
  source?: TransactionCreatedSource;
  statementId?: string | null;
  categoryId?: string | null;
}

/** The `transaction.created` event for a row that was just saved. */
export function transactionCreatedEvent(
  row: Pick<
    Transaction,
    | 'id'
    | 'workspaceId'
    | 'amount'
    | 'debit'
    | 'credit'
    | 'currency'
    | 'transactionDate'
    | 'counterpartyName'
    | 'transactionType'
    | 'statementId'
    | 'categoryId'
  >,
  source: TransactionCreatedSource,
): TransactionCreatedEvent {
  const amount = row.amount ?? row.debit ?? row.credit;
  return {
    workspaceId: row.workspaceId,
    transactionId: row.id,
    amount: amount === null || amount === undefined ? null : Number(amount),
    currency: row.currency,
    transactionDate: row.transactionDate,
    counterpartyName: row.counterpartyName,
    transactionType: row.transactionType,
    source,
    statementId: row.statementId ?? null,
    categoryId: row.categoryId ?? null,
  };
}

/** A bill or an invoice was paid in full (its status became paid). */
export interface PayablePaidEvent {
  workspaceId: string;
  payableId: string;
  direction: 'payable' | 'receivable';
  /** invoice: an invoice the workspace issued; statement or manual: a bill. */
  source: string;
  vendor: string;
  amount: number;
  currency: string;
  paidAt: string | null;
}

/** A bill or an invoice passed its due date unpaid. */
export interface PayableOverdueEvent {
  workspaceId: string;
  payableId: string;
  direction: 'payable' | 'receivable';
  /** invoice: an invoice the workspace issued; statement or manual: a bill. */
  source: string;
  vendor: string;
  outstanding: number;
  currency: string;
  dueDate: string;
}

/** A budget's spending reached its limit for the current period. */
export interface BudgetExceededEvent {
  workspaceId: string;
  budgetId: string;
  name: string;
  categoryId: string | null;
  limitAmount: number;
  spentAmount: number;
  percentUsed: number;
  currency: string;
}

/**
 * Taxable turnover crossed a registration-threshold escalation point.
 *
 * Emitted rather than calling NotificationsService directly: the tax module
 * would otherwise import the notifications module, which reaches back through
 * telegram → reports → transactions → tax and closes a module cycle.
 */
export interface TaxThresholdReachedEvent {
  workspaceId: string;
  /** 80 or 100. */
  level: number;
  turnover: number;
  threshold: number;
  currency: string;
  percentUsed: number;
  periodStart: string;
  periodEnd: string;
}

/**
 * A tax return is due soon (or is overdue) and has not been filed — or, for
 * income tax, finalized — in the app. Emitted once per return and reminder
 * point by the daily deadline sweep.
 */
export interface OfficialVatRatesChangedEvent {
  workspaceId: string;
  country: string;
  /** Differences from the official rates not announced before. */
  count: number;
}

export interface TaxDeadlineUpcomingEvent {
  workspaceId: string;
  kind: 'vat_return' | 'income_tax';
  /** VAT: the period; income tax: the tax year. */
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  /** Days from today to the due date; negative once overdue. */
  daysLeft: number;
  /** "USt-Voranmeldung", "Einkommensteuererklärung", … */
  returnName: string;
}

/**
 * A return was filed (in Lumio or marked as filed elsewhere): its reminders
 * no longer describe anything that needs doing.
 */
export interface TaxDeadlineResolvedEvent {
  workspaceId: string;
  kind: 'vat_return' | 'income_tax';
  periodEnd: string;
}
