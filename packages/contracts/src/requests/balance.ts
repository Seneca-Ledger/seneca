import * as Schema from 'effect/Schema';
import { IsoDateString, isAtMostTwoDecimals, NumericInput } from '../common/requests';
import type { Wire } from '../common/wire';

export const UpdateBalanceSnapshotBody = Schema.Struct({
  accountId: Schema.String.check(Schema.isUUID()),
  amount: NumericInput.check(isAtMostTwoDecimals),
  date: Schema.optional(IsoDateString),
  currency: Schema.optional(Schema.String),
});
export type UpdateBalanceSnapshotBody = Wire<typeof UpdateBalanceSnapshotBody>;

export const CreateBalanceAccountBody = Schema.Struct({
  name: Schema.String.check(Schema.isBetweenLength(1, 255)),
  nameEn: Schema.optional(Schema.String.check(Schema.isBetweenLength(1, 255))),
  nameKk: Schema.optional(Schema.String.check(Schema.isBetweenLength(1, 255))),
  parentId: Schema.String.check(Schema.isUUID()),
});
export type CreateBalanceAccountBody = Wire<typeof CreateBalanceAccountBody>;

export const UpdateAccountClassificationBody = Schema.Struct({
  /** Null clears the classification back to "not classified". */
  capitalRole: Schema.optional(Schema.NullOr(Schema.Literals(['income', 'neutral', 'drain']))),
  riskLevel: Schema.optional(Schema.NullOr(Schema.Literals(['low', 'medium', 'high']))),
});
export type UpdateAccountClassificationBody = Wire<typeof UpdateAccountClassificationBody>;
