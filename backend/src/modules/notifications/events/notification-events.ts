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
}

export interface TransactionCreatedEvent {
  workspaceId: string;
  transactionId: string;
  amount: number | null;
  currency: string;
  transactionDate: Date;
  counterpartyName: string;
  transactionType: string;
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
