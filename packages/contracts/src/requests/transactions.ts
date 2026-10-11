import * as Schema from 'effect/Schema';
import { IsoDateString, isAtMostTwoDecimals } from '../common/requests';
import type { Wire } from '../common/wire';

export const UpdateTransactionBody = Schema.Struct({
  transactionDate: Schema.optional(IsoDateString),
  documentNumber: Schema.optional(Schema.String),
  counterpartyName: Schema.optional(Schema.String),
  counterpartyBin: Schema.optional(Schema.String),
  counterpartyAccount: Schema.optional(Schema.String),
  counterpartyBank: Schema.optional(Schema.String),
  debit: Schema.optional(Schema.Finite),
  credit: Schema.optional(Schema.Finite),
  amountForeign: Schema.optional(Schema.Finite),
  exchangeRate: Schema.optional(Schema.Finite),
  amount: Schema.optional(Schema.Finite),
  currency: Schema.optional(Schema.String),
  paymentPurpose: Schema.optional(Schema.String),
  categoryId: Schema.optional(Schema.String.check(Schema.isUUID())),
  branchId: Schema.optional(Schema.String.check(Schema.isUUID())),
  walletId: Schema.optional(Schema.String.check(Schema.isUUID())),
  /**
   * Which member of the household the row belongs to. `null` hands it back to
   * the household as shared, which is why it is nullable rather than just
   * optional: leaving it out means "do not touch", sending null means "shared".
   */
  ownerMemberId: Schema.optional(Schema.NullOr(Schema.String.check(Schema.isUUID()))),
  article: Schema.optional(Schema.String),
  activityType: Schema.optional(Schema.String),
  transactionType: Schema.optional(Schema.Literals(['income', 'expense'])),
  comments: Schema.optional(Schema.String),
  isVerified: Schema.optional(Schema.Boolean),
  /**
   * Hides what the row was from the rest of the household. Only its owner may
   * set it, and only on a row that is theirs.
   */
  isPrivate: Schema.optional(Schema.Boolean),
});
export type UpdateTransactionBody = Wire<typeof UpdateTransactionBody>;

export const SplitPartInput = Schema.Struct({
  amount: Schema.Finite.check(isAtMostTwoDecimals, Schema.isGreaterThan(0)),
  categoryId: Schema.optional(Schema.String.check(Schema.isUUID())),
  paymentPurpose: Schema.optional(Schema.String.check(Schema.isMaxLength(500))),
  comments: Schema.optional(Schema.String.check(Schema.isMaxLength(1000))),
});
export type SplitPartInput = Wire<typeof SplitPartInput>;

export const SplitTransactionBody = Schema.Struct({
  parts: Schema.Array(SplitPartInput).check(Schema.isMinLength(2), Schema.isMaxLength(20)),
});
export type SplitTransactionBody = Wire<typeof SplitTransactionBody>;

export const BulkUpdateItemInput = Schema.Struct({
  id: Schema.String,
  updates: UpdateTransactionBody,
});
export type BulkUpdateItemInput = Wire<typeof BulkUpdateItemInput>;

/**
 * The endpoint accepts two shapes: the current `{items}` and the legacy
 * `{ids, updates}`. A union type on the `@Body()` gave the global
 * ValidationPipe an `Object` metatype and turned validation off entirely, so
 * both shapes are modelled here as optional fields and the handler picks one.
 */
export const BulkUpdateRequestBody = Schema.Struct({
  items: Schema.optional(Schema.Array(BulkUpdateItemInput)),
  ids: Schema.optional(Schema.Array(Schema.String)),
  updates: Schema.optional(UpdateTransactionBody),
});
export type BulkUpdateRequestBody = Wire<typeof BulkUpdateRequestBody>;

/**
 * Inline structural types on a `@Body()` give the global ValidationPipe an
 * `Object` metatype, which makes it a no-op — these ids reached the service
 * unchecked.
 */
export const DuplicateGroupInput = Schema.Struct({
  masterId: Schema.String.check(Schema.isUUID()),
  duplicateIds: Schema.Array(Schema.String.check(Schema.isUUID())).check(Schema.isMinLength(1)),
});
export type DuplicateGroupInput = Wire<typeof DuplicateGroupInput>;

export const MarkDuplicatesBody = Schema.Struct({
  groups: Schema.Array(DuplicateGroupInput).check(Schema.isMinLength(1)),
});
export type MarkDuplicatesBody = Wire<typeof MarkDuplicatesBody>;

export const MergeDuplicatesBody = Schema.Struct({
  transactionIds: Schema.Array(Schema.String.check(Schema.isUUID())).check(Schema.isMinLength(1)),
});
export type MergeDuplicatesBody = Wire<typeof MergeDuplicatesBody>;

export const DetectTransfersBody = Schema.Struct({
  /** Limit the run to the rows of one statement; omitted means the whole workspace. */
  statementId: Schema.optional(Schema.String.check(Schema.isUUID())),
});
export type DetectTransfersBody = Wire<typeof DetectTransfersBody>;

export const LinkTransferBody = Schema.Struct({
  /** The other leg of the transfer. */
  otherId: Schema.String.check(Schema.isUUID()),
});
export type LinkTransferBody = Wire<typeof LinkTransferBody>;

export const LinkReimbursementBody = Schema.Struct({
  /** The expense this incoming transaction pays back. */
  expenseId: Schema.String.check(Schema.isUUID()),
});
export type LinkReimbursementBody = Wire<typeof LinkReimbursementBody>;

export const SetTransactionTagsBody = Schema.Struct({
  /** The complete desired tag set for the transaction; an empty array clears it. */
  tagIds: Schema.Array(Schema.String.check(Schema.isUUID())).check(Schema.isMaxLength(50)),
});
export type SetTransactionTagsBody = Wire<typeof SetTransactionTagsBody>;
