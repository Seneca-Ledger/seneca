import * as Schema from 'effect/Schema';
import { IsoDateString, NumericInput, optionalNullable } from '../common/requests';
import type { Wire } from '../common/wire';

/** A rate entered by hand; it wins over provider rates for that day. */
export const ManualRateBody = Schema.Struct({
  from: Schema.String.check(Schema.isBetweenLength(3, 3)),
  to: Schema.String.check(Schema.isBetweenLength(3, 3)),
  rate: NumericInput.check(Schema.isGreaterThan(0)),
  /** YYYY-MM-DD; today when omitted. */
  date: optionalNullable(IsoDateString),
});
export type ManualRateBody = Wire<typeof ManualRateBody>;

export const ConvertItemInput = Schema.Struct({
  amount: Schema.Finite,
  currency: Schema.String,
  date: optionalNullable(IsoDateString),
});
export type ConvertItemInput = Wire<typeof ConvertItemInput>;

export const BulkConvertBody = Schema.Struct({
  items: Schema.Array(ConvertItemInput),
  targetCurrency: Schema.String,
});
export type BulkConvertBody = Wire<typeof BulkConvertBody>;
