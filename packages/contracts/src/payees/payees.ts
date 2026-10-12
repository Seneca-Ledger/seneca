import * as Schema from 'effect/Schema';
import type { Wire } from '../common/wire';

export const PayeeMode = Schema.Literals(['auto', 'always', 'never']);
export type PayeeMode = Wire<typeof PayeeMode>;

export const PayeeRef = Schema.Struct({ id: Schema.String, name: Schema.String });
export type PayeeRef = Wire<typeof PayeeRef>;

export const Payee = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  mode: PayeeMode,
  /** The pinned category, when `mode` is `always`. */
  category: Schema.NullOr(PayeeRef),
  /** What a new row of this payee would be filed as now, and why. */
  defaultCategory: Schema.NullOr(
    Schema.Struct({ id: Schema.String, name: Schema.String, source: Schema.String }),
  ),
  transactionCount: Schema.Number,
  lastSeen: Schema.NullOr(Schema.String),
});
export type Payee = Wire<typeof Payee>;

/** `GET /payees`: one page, with the total the pager needs. */
export const PayeesPage = Schema.Struct({
  data: Schema.Array(Payee),
  total: Schema.Number,
  page: Schema.Number,
  limit: Schema.Number,
});
export type PayeesPage = Wire<typeof PayeesPage>;

/** `GET /payees/:id/pending-review`: the payee's rows still waiting for a category. */
export const PayeePendingReview = Schema.Struct({ transactionIds: Schema.Array(Schema.String) });
export type PayeePendingReview = Wire<typeof PayeePendingReview>;
