import * as Schema from 'effect/Schema';
import { optionalNullable, TrimmedLowercase } from '../common/requests';
import type { Wire } from '../common/wire';

export const CreateSubscriptionBody = Schema.Struct({
  vendorName: Schema.String,
  amount: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
  frequency: Schema.Literals(['weekly', 'monthly', 'quarterly', 'annual']),
  currency: optionalNullable(Schema.String),
  categoryId: optionalNullable(Schema.String.check(Schema.isUUID())),
  nextChargeDate: optionalNullable(Schema.String),
  vendorDomain: optionalNullable(
    TrimmedLowercase.check(
      Schema.isMaxLength(253),
      Schema.isPattern(/^(?=.{4,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/, {
        message: 'vendorDomain must be a domain name',
      }),
    ),
  ),
});
export type CreateSubscriptionBody = Wire<typeof CreateSubscriptionBody>;

export const UpdateSubscriptionBody = Schema.Struct({
  vendorName: optionalNullable(Schema.String),
  amount: optionalNullable(Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0))),
  frequency: optionalNullable(Schema.Literals(['weekly', 'monthly', 'quarterly', 'annual'])),
  status: optionalNullable(Schema.Literals(['detected', 'active', 'paused', 'cancelled'])),
  currency: optionalNullable(Schema.String),
  categoryId: optionalNullable(Schema.String.check(Schema.isUUID())),
  nextChargeDate: optionalNullable(Schema.String),
  vendorDomain: optionalNullable(
    TrimmedLowercase.check(
      Schema.isMaxLength(253),
      Schema.isPattern(/^(?=.{4,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/, {
        message: 'vendorDomain must be a domain name',
      }),
    ),
  ),
});
export type UpdateSubscriptionBody = Wire<typeof UpdateSubscriptionBody>;

export const AssignSubscriptionOwnerBody = Schema.Struct({
  ownerId: Schema.String.check(Schema.isUUID()),
});
export type AssignSubscriptionOwnerBody = Wire<typeof AssignSubscriptionOwnerBody>;

export const RecordSubscriptionDecisionBody = Schema.Struct({
  decision: Schema.Literals(['owner_assigned', 'keep', 'review', 'cancelled', 'price_reduced']),
  note: optionalNullable(Schema.String),
  reviewAt: optionalNullable(Schema.String),
  realizedAnnualSavings: optionalNullable(Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0))),
});
export type RecordSubscriptionDecisionBody = Wire<typeof RecordSubscriptionDecisionBody>;
