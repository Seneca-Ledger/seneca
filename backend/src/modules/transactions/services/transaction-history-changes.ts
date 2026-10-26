import type { TransactionHistoryField, UpdateTransactionBody } from '../../../contracts';
import type { AuditEvent } from '../../../entities/audit-event.entity';
import type { Transaction } from '../../../entities/transaction.entity';

type Snapshot = Record<string, unknown>;

/**
 * The fields a person cares about, keyed by where the audit snapshot keeps
 * them. Everything else in a snapshot (ledger stamps, tax figures, updatedAt)
 * is bookkeeping and never shown. `undo` names the update field that puts the
 * old value back; a field without one cannot be undone from the history.
 */
export const FIELDS: ReadonlyArray<{
  field: TransactionHistoryField;
  key: keyof Transaction & string;
  undo?: keyof UpdateTransactionBody;
}> = [
  { field: 'category', key: 'categoryId', undo: 'categoryId' },
  { field: 'payee', key: 'payeeId' },
  { field: 'amount', key: 'amount' },
  { field: 'currency', key: 'currency' },
  { field: 'type', key: 'transactionType' },
  { field: 'date', key: 'transactionDate', undo: 'transactionDate' },
  { field: 'name', key: 'counterpartyName', undo: 'counterpartyName' },
  { field: 'purpose', key: 'paymentPurpose', undo: 'paymentPurpose' },
  { field: 'account', key: 'walletId', undo: 'walletId' },
  { field: 'owner', key: 'ownerMemberId', undo: 'ownerMemberId' },
  { field: 'private', key: 'isPrivate', undo: 'isPrivate' },
  { field: 'confirmed', key: 'isVerified', undo: 'isVerified' },
  { field: 'comment', key: 'comments', undo: 'comments' },
];

/** One value as the history compares and shows it: "289.00" and 289 are the same amount. */
export function normalize(field: TransactionHistoryField, value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (field === 'amount') {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount.toFixed(2) : null;
  }
  if (field === 'date') {
    const text = value instanceof Date ? value.toISOString() : String(value);
    return text.slice(0, 10);
  }
  return String(value).trim() || null;
}

export const asSnapshot = (value: unknown): Snapshot | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Snapshot) : null;

export interface RawChange {
  field: TransactionHistoryField;
  before: string | null;
  after: string | null;
}

/** The fields an event really changed: present on both sides and different. */
export function changesOf(event: AuditEvent): RawChange[] {
  const diff = asSnapshot(event.diff);
  const before = asSnapshot(diff?.before);
  const after = asSnapshot(diff?.after);
  if (!(before && after)) {
    return [];
  }
  const changes: RawChange[] = [];
  for (const { field, key } of FIELDS) {
    if (!(key in before && key in after)) {
      continue;
    }
    const was = normalize(field, before[key]);
    const now = normalize(field, after[key]);
    // An amount never becomes empty; a null there is a redacted snapshot.
    if (was === now || (field === 'amount' && (was === null || now === null))) {
      continue;
    }
    changes.push({ field, before: was, after: now });
  }
  return changes;
}
