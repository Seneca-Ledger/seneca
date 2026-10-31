import * as Schema from 'effect/Schema';
import {
  IsoDateString,
  isAtMostTwoDecimals,
  NumericInput,
  optionalNullable,
  PageInput,
} from '../common/requests';
import type { Wire } from '../common/wire';
import { PaymentType } from '../transactions/payment-type';

export const UpdateTransactionBody = Schema.Struct({
  transactionDate: optionalNullable(IsoDateString),
  documentNumber: optionalNullable(Schema.String),
  counterpartyName: optionalNullable(Schema.String),
  counterpartyBin: optionalNullable(Schema.String),
  counterpartyAccount: optionalNullable(Schema.String),
  counterpartyBank: optionalNullable(Schema.String),
  debit: optionalNullable(Schema.Finite),
  credit: optionalNullable(Schema.Finite),
  amountForeign: optionalNullable(Schema.Finite),
  exchangeRate: optionalNullable(Schema.Finite),
  amount: optionalNullable(Schema.Finite),
  currency: optionalNullable(Schema.String),
  paymentPurpose: optionalNullable(Schema.String),
  categoryId: optionalNullable(Schema.String.check(Schema.isUUID())),
  branchId: optionalNullable(Schema.String.check(Schema.isUUID())),
  walletId: optionalNullable(Schema.String.check(Schema.isUUID())),
  /**
   * Which member of the household the row belongs to. `null` hands it back to
   * the household as shared, which is why it is nullable rather than just
   * optional: leaving it out means "do not touch", sending null means "shared".
   */
  ownerMemberId: optionalNullable(Schema.String.check(Schema.isUUID())),
  article: optionalNullable(Schema.String),
  activityType: optionalNullable(Schema.String),
  transactionType: optionalNullable(Schema.Literals(['income', 'expense'])),
  comments: optionalNullable(Schema.String),
  isVerified: optionalNullable(Schema.Boolean),
  /**
   * Hides what the row was from the rest of the household. Only its owner may
   * set it, and only on a row that is theirs.
   */
  isPrivate: optionalNullable(Schema.Boolean),
  /**
   * Marks this one row as mattering for the tax return, or not, whatever its
   * category says. Null hands the decision back to the category.
   */
  taxRelevant: optionalNullable(Schema.Boolean),
});
export type UpdateTransactionBody = Wire<typeof UpdateTransactionBody>;

export const SplitPartInput = Schema.Struct({
  amount: Schema.Finite.check(isAtMostTwoDecimals, Schema.isGreaterThan(0)),
  categoryId: optionalNullable(Schema.String.check(Schema.isUUID())),
  paymentPurpose: optionalNullable(Schema.String.check(Schema.isMaxLength(500))),
  comments: optionalNullable(Schema.String.check(Schema.isMaxLength(1000))),
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
  items: optionalNullable(Schema.Array(BulkUpdateItemInput)),
  ids: optionalNullable(Schema.Array(Schema.String)),
  updates: optionalNullable(UpdateTransactionBody),
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
  statementId: optionalNullable(Schema.String.check(Schema.isUUID())),
});
export type DetectTransfersBody = Wire<typeof DetectTransfersBody>;

export const LinkTransferBody = Schema.Struct({
  /** The other leg of the transfer. */
  otherId: Schema.String.check(Schema.isUUID()),
});
export type LinkTransferBody = Wire<typeof LinkTransferBody>;

/**
 * `POST /transactions/:id/transfer-to-account`: the row moved money to (or
 * from) another of the user's accounts. Its other leg there is linked, or
 * booked when the account has none (cash taken out at an ATM).
 */
export const TransferToAccountBody = Schema.Struct({
  walletId: Schema.String.check(Schema.isUUID()),
});
export type TransferToAccountBody = Wire<typeof TransferToAccountBody>;

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

const Uuid = Schema.String.check(Schema.isUUID());

/** `/transactions/:id…`: a transaction's uuid. */
export const TransactionParams = Schema.Struct({ id: Uuid });
export type TransactionParams = Wire<typeof TransactionParams>;

/** `/transactions/attachments/:attachmentId…`. */
export const TransactionAttachmentParams = Schema.Struct({ attachmentId: Uuid });
export type TransactionAttachmentParams = Wire<typeof TransactionAttachmentParams>;

/** `/transactions/:id/history/:eventId/undo`. */
export const TransactionHistoryEventParams = Schema.Struct({ id: Uuid, eventId: Uuid });
export type TransactionHistoryEventParams = Wire<typeof TransactionHistoryEventParams>;

/**
 * `GET /transactions`. Snake and camel spellings of the same filter both stay
 * accepted; the snake one wins when both are sent.
 */
export const TransactionListQuery = Schema.Struct({
  statement_id: Schema.optional(Uuid),
  statementId: Schema.optional(Uuid),
  date_from: Schema.optional(IsoDateString),
  startDate: Schema.optional(IsoDateString),
  date_to: Schema.optional(IsoDateString),
  endDate: Schema.optional(IsoDateString),
  type: Schema.optional(Schema.Literals(['income', 'expense', 'transfer'])),
  category_id: Schema.optional(Uuid),
  categoryId: Schema.optional(Uuid),
  page: Schema.optional(PageInput),
  limit: Schema.optional(PageInput),
  currency: Schema.optional(Schema.String),
  convert_to: Schema.optional(Schema.String),
  /** `me`, `shared` or a membership id. */
  owner: Schema.optional(Schema.Union([Schema.Literals(['me', 'shared']), Uuid])),
  /** `1` adds each row's running wallet balance. */
  running_balance: Schema.optional(Schema.Literals(['0', '1'])),
  /** Only the rows of this account. */
  walletId: Schema.optional(Uuid),
  /** Only the rows of this payee. */
  payeeId: Schema.optional(Uuid),
  /** Only the rows paid this way. */
  paymentType: Schema.optional(PaymentType),
});
export type TransactionListQuery = Wire<typeof TransactionListQuery>;

/** `GET /transactions/duplicates/detect`. */
export const DuplicateDetectQuery = Schema.Struct({
  statement_id: Schema.optional(Uuid),
  /** Similarity a pair needs, 0 to 1 (default 0.85). */
  threshold: Schema.optional(
    NumericInput.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(1)),
  ),
});
export type DuplicateDetectQuery = Wire<typeof DuplicateDetectQuery>;
