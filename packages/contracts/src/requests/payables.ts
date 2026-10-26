import * as Schema from 'effect/Schema';
import * as Struct from 'effect/Struct';
import { BooleanInput, IsoDateString, NumericInput, optionalNullable } from '../common/requests';
import type { Wire } from '../common/wire';
import { PayableDirection, PayableSource, PayableStatus } from '../payables/payables';

export const CreatePayableBody = Schema.Struct({
  direction: optionalNullable(Schema.Literals(['payable', 'receivable'])),
  vendor: Schema.String.check(Schema.isMaxLength(255)),
  amount: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
  currency: optionalNullable(Schema.String.check(Schema.isMaxLength(3))),
  dueDate: optionalNullable(IsoDateString),
  status: optionalNullable(
    Schema.Literals(['to_pay', 'scheduled', 'partially_paid', 'paid', 'overdue', 'archived']),
  ),
  linkedTransactionId: optionalNullable(Schema.String.check(Schema.isUUID())),
  source: optionalNullable(Schema.Literals(['statement', 'invoice', 'manual'])),
  isRecurring: optionalNullable(Schema.Boolean),
  comment: optionalNullable(Schema.String),
  statementId: optionalNullable(Schema.String.check(Schema.isUUID())),
  /** The whole tag set, from the workspace's tags; on update it replaces the old one. */
  tagIds: optionalNullable(
    Schema.Array(Schema.String.check(Schema.isUUID())).check(Schema.isMaxLength(50)),
  ),
});
export type CreatePayableBody = Wire<typeof CreatePayableBody>;

export const AddPayablePaymentBody = Schema.Struct({
  /** How much of the bill this settles, in the bill's currency. */
  amount: NumericInput.check(Schema.isGreaterThan(0)),
  /** What the processor kept: the bank received `amount - feeAmount`. */
  feeAmount: optionalNullable(NumericInput.check(Schema.isGreaterThanOrEqualTo(0))),
  /** Day of the payment; today when omitted. */
  paidOn: optionalNullable(IsoDateString),
  /** An existing transaction this payment came from. */
  linkedTransactionId: optionalNullable(Schema.String.check(Schema.isUUID())),
  /** Paid in cash: record the payment as a new transaction of this wallet. */
  payFromWalletId: optionalNullable(Schema.String.check(Schema.isUUID())),
  /** Cash handed over in person, kept in no wallet: booked as a transaction without one. */
  inHand: optionalNullable(Schema.Boolean),
  /** Category of the cash payment's transaction. */
  categoryId: optionalNullable(Schema.String.check(Schema.isUUID())),
  comment: optionalNullable(Schema.String.check(Schema.isMaxLength(500))),
});
export type AddPayablePaymentBody = Wire<typeof AddPayablePaymentBody>;

/**
 * `POST /payables/:id/payments/:paymentId/book`: where the money of a payment
 * marked without it went — a bank row already in Seneca, or a wallet (cash).
 */
export const BookPayablePaymentBody = Schema.Struct({
  linkedTransactionId: optionalNullable(Schema.String.check(Schema.isUUID())),
  payFromWalletId: optionalNullable(Schema.String.check(Schema.isUUID())),
  /** Cash handed over in person, kept in no wallet: booked as a transaction without one. */
  inHand: optionalNullable(Schema.Boolean),
  /** Category of the wallet transaction. */
  categoryId: optionalNullable(Schema.String.check(Schema.isUUID())),
});
export type BookPayablePaymentBody = Wire<typeof BookPayablePaymentBody>;

export const TransactionAllocationInput = Schema.Struct({
  payableId: Schema.String.check(Schema.isUUID()),
  amount: NumericInput.check(Schema.isGreaterThan(0)),
  feeAmount: optionalNullable(NumericInput.check(Schema.isGreaterThanOrEqualTo(0))),
});
export type TransactionAllocationInput = Wire<typeof TransactionAllocationInput>;

/** One transaction spread over several bills. */
export const AllocateTransactionBody = Schema.Struct({
  transactionId: Schema.String.check(Schema.isUUID()),
  allocations: Schema.Array(TransactionAllocationInput).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(50),
  ),
  paidOn: optionalNullable(IsoDateString),
  comment: optionalNullable(Schema.String.check(Schema.isMaxLength(500))),
});
export type AllocateTransactionBody = Wire<typeof AllocateTransactionBody>;

export const UpdatePayableBody = CreatePayableBody.mapFields(
  Struct.omit(['linkedTransactionId', 'comment', 'statementId']),
)
  .mapFields(Struct.map(optionalNullable))
  .mapFields(
    Struct.assign({
      linkedTransactionId: optionalNullable(Schema.String.check(Schema.isUUID())),
      comment: optionalNullable(Schema.String),
      statementId: optionalNullable(Schema.String.check(Schema.isUUID())),
    }),
  );
export type UpdatePayableBody = Wire<typeof UpdatePayableBody>;

export const MarkPayablePaidBody = Schema.Struct({
  /** An existing transaction that settled the bill. */
  linkedTransactionId: optionalNullable(Schema.String.check(Schema.isUUID())),
  /** Paid in cash: record the payment as a new transaction of this wallet. */
  payFromWalletId: optionalNullable(Schema.String.check(Schema.isUUID())),
  /** Cash handed over in person, kept in no wallet: booked as a transaction without one. */
  inHand: optionalNullable(Schema.Boolean),
  /** Day of the cash payment; today when omitted. */
  paidOn: optionalNullable(IsoDateString),
  /** Category of the cash payment's transaction. */
  categoryId: optionalNullable(Schema.String.check(Schema.isUUID())),
});
export type MarkPayablePaidBody = Wire<typeof MarkPayablePaidBody>;

export const FilterPayablesBody = Schema.Struct({
  /** Defaults to `payable` so existing clients keep seeing only what the workspace owes. */
  direction: optionalNullable(Schema.Literals(['payable', 'receivable'])),
  page: optionalNullable(NumericInput.check(Schema.isGreaterThanOrEqualTo(1))),
  limit: optionalNullable(
    NumericInput.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(100)),
  ),
  search: optionalNullable(Schema.String),
  status: optionalNullable(
    Schema.Literals(['to_pay', 'scheduled', 'partially_paid', 'paid', 'overdue', 'archived']),
  ),
  source: optionalNullable(Schema.Literals(['statement', 'invoice', 'manual'])),
  dueDateFrom: optionalNullable(IsoDateString),
  dueDateTo: optionalNullable(IsoDateString),
  minAmount: optionalNullable(NumericInput.check(Schema.isGreaterThanOrEqualTo(0))),
  maxAmount: optionalNullable(NumericInput.check(Schema.isGreaterThanOrEqualTo(0))),
  includeArchived: optionalNullable(BooleanInput),
  /** Only bills carrying this tag. */
  tagId: optionalNullable(Schema.String.check(Schema.isUUID())),
  sort: optionalNullable(Schema.Literals(['dueDateAsc', 'dueDateDesc', 'amountDesc', 'vendorAsc'])),
  format: optionalNullable(Schema.Literals(['excel', 'csv'])),
});
export type FilterPayablesBody = Wire<typeof FilterPayablesBody>;

const Uuid = Schema.String.check(Schema.isUUID());

/** `/payables/:id/...`. */
export const PayableParams = Schema.Struct({ id: Uuid });
export type PayableParams = Wire<typeof PayableParams>;

/** `/payables/:id/payments/:paymentId/...`. */
export const PayablePaymentParams = Schema.Struct({ id: Uuid, paymentId: Uuid });
export type PayablePaymentParams = Wire<typeof PayablePaymentParams>;

/** `GET /payables/allocation-suggestion/:transactionId`. */
export const PayableTransactionParams = Schema.Struct({ transactionId: Uuid });
export type PayableTransactionParams = Wire<typeof PayableTransactionParams>;

/** `GET /payables`, its summary and its export. */
export const PayablesQuery = Schema.Struct({
  /** Defaults to `payable` so existing clients keep seeing only what the workspace owes. */
  direction: Schema.optional(PayableDirection),
  page: Schema.optional(NumericInput.check(Schema.isGreaterThanOrEqualTo(1))),
  limit: Schema.optional(
    NumericInput.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(100)),
  ),
  search: Schema.optional(Schema.String),
  status: Schema.optional(PayableStatus),
  source: Schema.optional(PayableSource),
  dueDateFrom: Schema.optional(IsoDateString),
  dueDateTo: Schema.optional(IsoDateString),
  minAmount: Schema.optional(NumericInput.check(Schema.isGreaterThanOrEqualTo(0))),
  maxAmount: Schema.optional(NumericInput.check(Schema.isGreaterThanOrEqualTo(0))),
  includeArchived: Schema.optional(BooleanInput),
  /** Only bills carrying this tag. */
  tagId: Schema.optional(Uuid),
  sort: Schema.optional(Schema.Literals(['dueDateAsc', 'dueDateDesc', 'amountDesc', 'vendorAsc'])),
  format: Schema.optional(Schema.Literals(['excel', 'csv'])),
});
export type PayablesQuery = Wire<typeof PayablesQuery>;
