import * as Schema from 'effect/Schema';
import {
  DateOnlyInput,
  MonthInput,
  NumericInput,
  optionalNullable,
  TrimmedLowercase,
} from '../common/requests';
import type { Wire } from '../common/wire';
import { SubscriptionStatus } from '../subscriptions/subscriptions';

const Uuid = Schema.String.check(Schema.isUUID());

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

export const SubscriptionParams = Schema.Struct({ id: Uuid });
export type SubscriptionParams = Wire<typeof SubscriptionParams>;

export const SubscriptionChargeParams = Schema.Struct({ id: Uuid, chargeId: Uuid });
export type SubscriptionChargeParams = Wire<typeof SubscriptionChargeParams>;

/** `GET /subscriptions`. */
export const SubscriptionsQuery = Schema.Struct({ status: Schema.optional(SubscriptionStatus) });
export type SubscriptionsQuery = Wire<typeof SubscriptionsQuery>;

/** `GET /subscriptions/month-status`: that month's charges; the month we are in when absent. */
export const SubscriptionMonthStatusQuery = Schema.Struct({ month: Schema.optional(MonthInput) });
export type SubscriptionMonthStatusQuery = Wire<typeof SubscriptionMonthStatusQuery>;

/** `GET /subscriptions/upcoming`: charges within this many days, default 7. */
export const UpcomingSubscriptionsQuery = Schema.Struct({
  days: Schema.optional(NumericInput.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0))),
});
export type UpcomingSubscriptionsQuery = Wire<typeof UpcomingSubscriptionsQuery>;

/** `GET /subscriptions/business-report`: JSON unless `format=csv`. */
export const SubscriptionBusinessReportQuery = Schema.Struct({
  format: Schema.optional(Schema.Literals(['csv', 'json'])),
});
export type SubscriptionBusinessReportQuery = Wire<typeof SubscriptionBusinessReportQuery>;
