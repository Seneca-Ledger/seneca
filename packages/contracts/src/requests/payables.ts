import * as Schema from 'effect/Schema';
import * as Struct from 'effect/Struct';
import { BooleanInput, IsoDateString, NumericInput } from '../common/requests';
import type { Wire } from '../common/wire';

export const CreatePayableBody = Schema.Struct({
  direction: Schema.optional(Schema.Literals(['payable', 'receivable'])),
  vendor: Schema.String.check(Schema.isMaxLength(255)),
  amount: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
  currency: Schema.optional(Schema.String.check(Schema.isMaxLength(3))),
  dueDate: Schema.optional(IsoDateString),
  status: Schema.optional(
    Schema.Literals(['to_pay', 'scheduled', 'partially_paid', 'paid', 'overdue', 'archived']),
  ),
  linkedTransactionId: Schema.optional(Schema.String.check(Schema.isUUID())),
  source: Schema.optional(Schema.Literals(['statement', 'invoice', 'manual'])),
  isRecurring: Schema.optional(Schema.Boolean),
  comment: Schema.optional(Schema.String),
  statementId: Schema.optional(Schema.String.check(Schema.isUUID())),
});
export type CreatePayableBody = Wire<typeof CreatePayableBody>;

export const AddPayablePaymentBody = Schema.Struct({
  /** How much of the bill this settles, in the bill's currency. */
  amount: NumericInput.check(Schema.isGreaterThan(0)),
  /** What the processor kept: the bank received `amount - feeAmount`. */
  feeAmount: Schema.optional(NumericInput.check(Schema.isGreaterThanOrEqualTo(0))),
  /** Day of the payment; today when omitted. */
  paidOn: Schema.optional(IsoDateString),
  /** An existing transaction this payment came from. */
  linkedTransactionId: Schema.optional(Schema.String.check(Schema.isUUID())),
  /** Paid in cash: record the payment as a new transaction of this wallet. */
  payFromWalletId: Schema.optional(Schema.String.check(Schema.isUUID())),
  /** Category of the cash payment's transaction. */
  categoryId: Schema.optional(Schema.String.check(Schema.isUUID())),
  comment: Schema.optional(Schema.String.check(Schema.isMaxLength(500))),
});
export type AddPayablePaymentBody = Wire<typeof AddPayablePaymentBody>;

export const TransactionAllocationInput = Schema.Struct({
  payableId: Schema.String.check(Schema.isUUID()),
  amount: NumericInput.check(Schema.isGreaterThan(0)),
  feeAmount: Schema.optional(NumericInput.check(Schema.isGreaterThanOrEqualTo(0))),
});
export type TransactionAllocationInput = Wire<typeof TransactionAllocationInput>;

/** One transaction spread over several bills. */
export const AllocateTransactionBody = Schema.Struct({
  transactionId: Schema.String.check(Schema.isUUID()),
  allocations: Schema.Array(TransactionAllocationInput).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(50),
  ),
  paidOn: Schema.optional(IsoDateString),
  comment: Schema.optional(Schema.String.check(Schema.isMaxLength(500))),
});
export type AllocateTransactionBody = Wire<typeof AllocateTransactionBody>;

export const UpdatePayableBody = CreatePayableBody.mapFields(
  Struct.omit(['linkedTransactionId', 'comment', 'statementId']),
)
  .mapFields(Struct.map(Schema.optional))
  .mapFields(
    Struct.assign({
      linkedTransactionId: Schema.optional(Schema.NullOr(Schema.String.check(Schema.isUUID()))),
      comment: Schema.optional(Schema.NullOr(Schema.String)),
      statementId: Schema.optional(Schema.NullOr(Schema.String.check(Schema.isUUID()))),
    }),
  );
export type UpdatePayableBody = Wire<typeof UpdatePayableBody>;

export const MarkPayablePaidBody = Schema.Struct({
  /** An existing transaction that settled the bill. */
  linkedTransactionId: Schema.optional(Schema.String.check(Schema.isUUID())),
  /** Paid in cash: record the payment as a new transaction of this wallet. */
  payFromWalletId: Schema.optional(Schema.String.check(Schema.isUUID())),
  /** Day of the cash payment; today when omitted. */
  paidOn: Schema.optional(IsoDateString),
  /** Category of the cash payment's transaction. */
  categoryId: Schema.optional(Schema.String.check(Schema.isUUID())),
});
export type MarkPayablePaidBody = Wire<typeof MarkPayablePaidBody>;

export const FilterPayablesBody = Schema.Struct({
  /** Defaults to `payable` so existing clients keep seeing only what the workspace owes. */
  direction: Schema.optional(Schema.Literals(['payable', 'receivable'])),
  page: Schema.optional(NumericInput.check(Schema.isGreaterThanOrEqualTo(1))),
  limit: Schema.optional(
    NumericInput.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(100)),
  ),
  search: Schema.optional(Schema.String),
  status: Schema.optional(
    Schema.Literals(['to_pay', 'scheduled', 'partially_paid', 'paid', 'overdue', 'archived']),
  ),
  source: Schema.optional(Schema.Literals(['statement', 'invoice', 'manual'])),
  dueDateFrom: Schema.optional(IsoDateString),
  dueDateTo: Schema.optional(IsoDateString),
  minAmount: Schema.optional(NumericInput.check(Schema.isGreaterThanOrEqualTo(0))),
  maxAmount: Schema.optional(NumericInput.check(Schema.isGreaterThanOrEqualTo(0))),
  includeArchived: Schema.optional(BooleanInput),
  sort: Schema.optional(Schema.Literals(['dueDateAsc', 'dueDateDesc', 'amountDesc', 'vendorAsc'])),
  format: Schema.optional(Schema.Literals(['excel', 'csv'])),
});
export type FilterPayablesBody = Wire<typeof FilterPayablesBody>;
