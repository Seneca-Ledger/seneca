import * as Schema from 'effect/Schema';
import type { Wire } from '../common/wire';
import { ReviewInboxCounts } from '../feed/feed';

export const ReviewInboxKind = Schema.Literals([
  'transaction',
  'receipt',
  'duplicate',
  'subscription',
]);
export type ReviewInboxKind = Wire<typeof ReviewInboxKind>;

/** A bank row whose category is missing or was guessed. */
export const ReviewTransactionItem = Schema.Struct({
  kind: Schema.Literal('transaction'),
  id: Schema.String,
  date: Schema.String,
  counterpartyName: Schema.String,
  paymentPurpose: Schema.String,
  /** Who the row is filed under; null when its descriptor names nobody. */
  payee: Schema.NullOr(Schema.Struct({ id: Schema.String, name: Schema.String })),
  amount: Schema.Number,
  currency: Schema.String,
  transactionType: Schema.String,
  categoryId: Schema.NullOr(Schema.String),
  categoryName: Schema.NullOr(Schema.String),
  categorySource: Schema.NullOr(Schema.String),
  categoryReason: Schema.NullOr(Schema.String),
  statementId: Schema.NullOr(Schema.String),
  /** The receipt behind the row (a scan, or one attached to it); the page to open. */
  receiptId: Schema.NullOr(Schema.String),
});
export type ReviewTransactionItem = Wire<typeof ReviewTransactionItem>;

/** A scanned receipt that could not be read in full. */
export const ReviewReceiptItem = Schema.Struct({
  kind: Schema.Literal('receipt'),
  id: Schema.String,
  date: Schema.NullOr(Schema.String),
  vendor: Schema.NullOr(Schema.String),
  amount: Schema.NullOr(Schema.Number),
  currency: Schema.NullOr(Schema.String),
  issues: Schema.Array(Schema.String),
});
export type ReviewReceiptItem = Wire<typeof ReviewReceiptItem>;

/** A row that looks like one already booked. */
export const ReviewDuplicateItem = Schema.Struct({
  kind: Schema.Literal('duplicate'),
  id: Schema.String,
  date: Schema.String,
  counterpartyName: Schema.String,
  amount: Schema.Number,
  currency: Schema.String,
  duplicateOfId: Schema.NullOr(Schema.String),
  confidence: Schema.NullOr(Schema.Number),
  matchType: Schema.NullOr(Schema.String),
});
export type ReviewDuplicateItem = Wire<typeof ReviewDuplicateItem>;

/** A subscription detected from the charges, waiting to be confirmed. */
export const ReviewSubscriptionItem = Schema.Struct({
  kind: Schema.Literal('subscription'),
  id: Schema.String,
  vendorName: Schema.String,
  amount: Schema.Number,
  currency: Schema.String,
  frequency: Schema.String,
  confidence: Schema.NullOr(Schema.Number),
  nextChargeDate: Schema.NullOr(Schema.String),
});
export type ReviewSubscriptionItem = Wire<typeof ReviewSubscriptionItem>;

export const ReviewInboxItem = Schema.Union([
  ReviewTransactionItem,
  ReviewReceiptItem,
  ReviewDuplicateItem,
  ReviewSubscriptionItem,
]);
export type ReviewInboxItem = Wire<typeof ReviewInboxItem>;

/** `GET /review-inbox`: one kind's page plus the counts of every kind. */
export const ReviewInboxPage = Schema.Struct({
  kind: ReviewInboxKind,
  counts: ReviewInboxCounts,
  items: Schema.Array(ReviewInboxItem),
  total: Schema.Number,
  page: Schema.Number,
  limit: Schema.Number,
});
export type ReviewInboxPage = Wire<typeof ReviewInboxPage>;

/** `GET /review-inbox/statements`: rows waiting for review, by statement id. */
export const ReviewInboxByStatement = Schema.Record(Schema.String, Schema.Number);
export type ReviewInboxByStatement = Wire<typeof ReviewInboxByStatement>;
