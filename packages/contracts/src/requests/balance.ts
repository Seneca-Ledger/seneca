import * as Schema from 'effect/Schema';
import {
  IsoDateString,
  isAtMostTwoDecimals,
  NumericInput,
  optionalNullable,
} from '../common/requests';
import type { Wire } from '../common/wire';

export const UpdateBalanceSnapshotBody = Schema.Struct({
  accountId: Schema.String.check(Schema.isUUID()),
  amount: NumericInput.check(isAtMostTwoDecimals),
  date: optionalNullable(IsoDateString),
  currency: optionalNullable(Schema.String),
});
export type UpdateBalanceSnapshotBody = Wire<typeof UpdateBalanceSnapshotBody>;

export const CreateBalanceAccountBody = Schema.Struct({
  name: Schema.String.check(Schema.isBetweenLength(1, 255)),
  nameEn: optionalNullable(Schema.String.check(Schema.isBetweenLength(1, 255))),
  nameKk: optionalNullable(Schema.String.check(Schema.isBetweenLength(1, 255))),
  parentId: Schema.String.check(Schema.isUUID()),
});
export type CreateBalanceAccountBody = Wire<typeof CreateBalanceAccountBody>;

export const UpdateAccountClassificationBody = Schema.Struct({
  /** Null clears the classification back to "not classified". */
  capitalRole: optionalNullable(Schema.Literals(['income', 'neutral', 'drain'])),
  riskLevel: optionalNullable(Schema.Literals(['low', 'medium', 'high'])),
});
export type UpdateAccountClassificationBody = Wire<typeof UpdateAccountClassificationBody>;
