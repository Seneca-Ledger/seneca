import * as Schema from 'effect/Schema';
import type { Wire } from '../common/wire';

/**
 * One slice of a pie on the All transactions page. `key` is stable (an id, or
 * the counterparty's name); `name` is what the legend shows. `value` is the
 * absolute amount in the overview's currency.
 */
const OverviewSlice = Schema.Struct({
  key: Schema.String,
  name: Schema.String,
  value: Schema.Number,
});

/**
 * `GET /transactions/overview`: what the period's money was spent on, which
 * accounts it left and where it went, plus how many rows each of the last twelve
 * months holds. Slices count confirmed rows only; month counts follow the list.
 */
export const TransactionsOverview = Schema.Struct({
  currency: Schema.String,
  categories: Schema.Array(OverviewSlice),
  sources: Schema.Array(OverviewSlice),
  destinations: Schema.Array(OverviewSlice),
  months: Schema.Array(Schema.Struct({ month: Schema.String, count: Schema.Number })),
});
export type TransactionsOverview = Wire<typeof TransactionsOverview>;
