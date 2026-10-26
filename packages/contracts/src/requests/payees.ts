import * as Schema from 'effect/Schema';
import { NumericInput, optionalNullable, PageInput } from '../common/requests';
import type { Wire } from '../common/wire';

export const UpdatePayeeBody = Schema.Struct({
  name: optionalNullable(Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200))),
  mode: optionalNullable(Schema.Literals(['auto', 'always', 'never'])),
  /** The pinned category; required with `mode: always`, null clears it. */
  categoryId: optionalNullable(Schema.String.check(Schema.isUUID())),
  /** ISO-3166-1 alpha-2 of the payee's seat; null clears it. */
  countryCode: optionalNullable(Schema.String.check(Schema.isPattern(/^[A-Za-z]{2}$/))),
  /** The payee's VAT number; null or blank clears it. */
  vatId: optionalNullable(Schema.String.check(Schema.isMaxLength(32))),
  /** What the payee supplies: decides the VAT return line of a cross-border reverse charge. */
  supplyType: optionalNullable(Schema.Literals(['goods', 'services'])),
});
export type UpdatePayeeBody = Wire<typeof UpdatePayeeBody>;

export const MergePayeesBody = Schema.Struct({
  sourceIds: Schema.Array(Schema.String.check(Schema.isUUID())).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(100),
  ),
});
export type MergePayeesBody = Wire<typeof MergePayeesBody>;

/** Either an existing payee, or a name to find or create one by. */
export const SetTransactionPayeeBody = Schema.Struct({
  payeeId: optionalNullable(Schema.String.check(Schema.isUUID())),
  name: optionalNullable(Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200))),
}).check(
  Schema.makeFilter(body =>
    body.payeeId !== undefined || body.name !== undefined
      ? undefined
      : 'payeeId or name is required',
  ),
);
export type SetTransactionPayeeBody = Wire<typeof SetTransactionPayeeBody>;

/** `/payees/:id…` and `/transactions/:id/payee`: the record's uuid. */
export const PayeeParams = Schema.Struct({ id: Schema.String.check(Schema.isUUID()) });
export type PayeeParams = Wire<typeof PayeeParams>;

/** `GET /payees/:id/pending-review`. */
export const PayeePendingReviewQuery = Schema.Struct({
  excludeTransactionId: Schema.optional(Schema.String.check(Schema.isUUID())),
});
export type PayeePendingReviewQuery = Wire<typeof PayeePendingReviewQuery>;

/** `DELETE /payees/:id/aliases/:key`: the payee and how a statement writes its name. */
export const PayeeAliasParams = Schema.Struct({
  id: Schema.String.check(Schema.isUUID()),
  key: Schema.String.check(Schema.isMinLength(1)),
});
export type PayeeAliasParams = Wire<typeof PayeeAliasParams>;

/** `GET /payees/overview`: who was paid (or paid us) in a month, or ever. */
export const PayeesOverviewQuery = Schema.Struct({
  /** `YYYY-MM`; left out for all time. */
  month: Schema.optional(Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}$/))),
  direction: Schema.optional(Schema.Literals(['expense', 'income'])),
  search: Schema.optional(Schema.String.check(Schema.isMaxLength(200))),
  page: Schema.optional(PageInput),
  limit: Schema.optional(
    NumericInput.check(
      Schema.isInt(),
      Schema.isGreaterThanOrEqualTo(1),
      Schema.isLessThanOrEqualTo(200),
    ),
  ),
});
export type PayeesOverviewQuery = Wire<typeof PayeesOverviewQuery>;
