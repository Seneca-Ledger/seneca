import * as Schema from 'effect/Schema';
import { DateOnlyInput, optionalNullable, TrimmedLowercase } from '../common/requests';
import type { Wire } from '../common/wire';

export const CreateSubscriptionBody = Schema.Struct({
  vendorName: Schema.String,
  amount: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
  frequency: Schema.Literals(['weekly', 'monthly', 'quarterly', 'annual']),
  currency: optionalNullable(Schema.String),
  categoryId: optionalNullable(Schema.String.check(Schema.isUUID())),
  /** The budget its money comes out of; null unlinks it. */
  budgetId: optionalNullable(Schema.String.check(Schema.isUUID())),
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
  /** The budget its money comes out of; null unlinks it. */
  budgetId: optionalNullable(Schema.String.check(Schema.isUUID())),
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

/**
 * `POST /subscriptions/:id/charges`: a payment already made. Either a bank row
 * (`transactionId`: its date and amount are used) or a date with an optional
 * amount (the subscription's price when left out), linked to a row later.
 */
export const RecordSubscriptionChargeBody = Schema.Struct({
  transactionId: optionalNullable(Schema.String.check(Schema.isUUID())),
  chargeDate: optionalNullable(DateOnlyInput),
  amount: optionalNullable(Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0))),
});
export type RecordSubscriptionChargeBody = Wire<typeof RecordSubscriptionChargeBody>;

/** `PATCH /subscriptions/:id/charges/:chargeId`: link a payment to its bank row. */
export const LinkSubscriptionChargeBody = Schema.Struct({
  transactionId: Schema.String.check(Schema.isUUID()),
});
export type LinkSubscriptionChargeBody = Wire<typeof LinkSubscriptionChargeBody>;
