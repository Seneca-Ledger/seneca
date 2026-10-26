import * as Schema from 'effect/Schema';
import * as Struct from 'effect/Struct';
import { DateOnly, DecimalString, Timestamp, type Wire } from '../common/wire';
import { CategoryRef } from '../reference/reference';

export const SubscriptionFrequency = Schema.Literals(['weekly', 'monthly', 'quarterly', 'annual']);
export type SubscriptionFrequency = Wire<typeof SubscriptionFrequency>;

export const SubscriptionStatus = Schema.Literals(['detected', 'active', 'paused', 'cancelled']);
export type SubscriptionStatus = Wire<typeof SubscriptionStatus>;

/** One row of `GET /subscriptions`. */
export const SubscriptionItem = Schema.Struct({
  id: Schema.String,
  workspaceId: Schema.String,
  vendorName: Schema.String,
  vendorRaw: Schema.NullOr(Schema.String),
  vendorDomain: Schema.NullOr(Schema.String),
  amount: DecimalString,
  currency: Schema.String,
  frequency: SubscriptionFrequency,
  status: SubscriptionStatus,
  /** A user id; the name comes from the workspace's member list. */
  ownerId: Schema.NullOr(Schema.String),
  reviewAt: Schema.NullOr(DateOnly),
  reviewStatus: Schema.Literals(['current', 'needs_review']),
  riskStatus: Schema.Literals(['none', 'price_changed', 'date_shifted', 'missing_charge']),
  cancellationReason: Schema.NullOr(Schema.String),
  realizedAnnualSavings: DecimalString,
  /** 0..1 for a detected subscription; null for one entered by hand. */
  confidence: Schema.NullOr(DecimalString),
  nextChargeDate: Schema.NullOr(DateOnly),
  lastChargeDate: Schema.NullOr(DateOnly),
  categoryId: Schema.NullOr(Schema.String),
  category: Schema.NullOr(CategoryRef),
  /** The budget its money comes out of: its payments take that budget's category. */
  budgetId: Schema.NullOr(Schema.String),
  usageCount: Schema.Number,
  usageSince: Schema.NullOr(Timestamp),
  lastUsedAt: Schema.NullOr(Timestamp),
  sinkingGoalId: Schema.NullOr(Schema.String),
  /** Free-form detection notes; `priceChange` is the one the UI reads. */
  detectionMeta: Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown)),
  createdById: Schema.NullOr(Schema.String),
  createdAt: Timestamp,
  updatedAt: Timestamp,
  /** Monthly cost over the taps since the counter started; null until the first tap. */
  costPerUse: Schema.NullOr(Schema.Number),
});
export type SubscriptionItem = Wire<typeof SubscriptionItem>;

export const SubscriptionList = Schema.Array(SubscriptionItem);

/** `GET /subscriptions/upcoming?days=`: active subscriptions charging within that many days. */
export const UpcomingSubscriptionList = Schema.Array(
  Schema.Struct({
    id: Schema.String,
    vendorName: Schema.String,
    amount: DecimalString,
    currency: Schema.String,
    nextChargeDate: Schema.NullOr(DateOnly),
  }),
);
export type UpcomingSubscriptionList = Wire<typeof UpcomingSubscriptionList>;
export type SubscriptionList = Wire<typeof SubscriptionList>;

/** `GET /subscriptions/summary`, in the workspace currency. */
export const SubscriptionSummary = Schema.Struct({
  totalMonthlyCost: Schema.Number,
  activeCount: Schema.Number,
  upcomingCount: Schema.Number,
  /** Charges due in the next 30 days, today included; a weekly plan counts each one. */
  upcoming30DaysCount: Schema.Number,
  /** What those charges come to, in the workspace currency. */
  upcoming30DaysAmount: Schema.Number,
  priceChangeCount: Schema.Number,
  /** What this year costs more (or less) because of the flagged price changes. */
  priceChangeYearlyEffect: Schema.Number,
  duplicateCount: Schema.Number,
  overdueReviewCount: Schema.Number,
  realizedAnnualSavings: Schema.Number,
});
export type SubscriptionSummary = Wire<typeof SubscriptionSummary>;

/** `GET /subscriptions/month-status`: this month's charges, paid so far and still to come. */
export const SubscriptionMonthStatus = Schema.Struct({
  /** Workspace currency the amounts are in. */
  currency: Schema.NullOr(Schema.String),
  /** YYYY-MM */
  month: Schema.String,
  paidAmount: Schema.Number,
  paidCount: Schema.Number,
  unpaidAmount: Schema.Number,
  unpaidCount: Schema.Number,
  /** Each subscription charged this month, still to pay first, then by next charge date. */
  items: Schema.Array(
    Schema.Struct({
      subscriptionId: Schema.String,
      vendorName: Schema.String,
      vendorDomain: Schema.NullOr(Schema.String),
      /** This month's charges together, in the workspace currency. */
      amount: Schema.Number,
      /** Every charge this month has fallen on or before today. */
      paid: Schema.Boolean,
      nextChargeDate: Schema.NullOr(DateOnly),
    }),
  ),
});
export type SubscriptionMonthStatus = Wire<typeof SubscriptionMonthStatus>;

/** `GET /subscriptions/charge-calendar`: what leaves each month, row by row. */
export const SubscriptionChargeCalendar = Schema.Struct({
  currency: Schema.NullOr(Schema.String),
  /** YYYY-MM, oldest first; `monthTotals` and each row's `amounts` follow this order. */
  months: Schema.Array(Schema.String),
  monthTotals: Schema.Array(Schema.Number),
  rows: Schema.Array(
    Schema.Struct({
      subscriptionId: Schema.String,
      vendorName: Schema.String,
      vendorDomain: Schema.NullOr(Schema.String),
      amounts: Schema.Array(Schema.Number),
      /** Subscriptions are the default; bills to pay and invoices to be paid share the grid. */
      kind: Schema.optional(Schema.Literals(['subscription', 'payable', 'invoice'])),
    }),
  ),
});
export type SubscriptionChargeCalendar = Wire<typeof SubscriptionChargeCalendar>;

/** `GET /subscriptions/duplicates`: rows that look like the same service paid twice. */
export const SubscriptionDuplicateGroups = Schema.Array(
  Schema.Struct({
    key: Schema.String,
    items: Schema.Array(
      Schema.Struct({
        id: Schema.String,
        vendorName: Schema.String,
        amount: Schema.Number,
        currency: Schema.String,
        frequency: SubscriptionFrequency,
        status: SubscriptionStatus,
        ownerId: Schema.NullOr(Schema.String),
      }),
    ),
  }),
);
export type SubscriptionDuplicateGroups = Wire<typeof SubscriptionDuplicateGroups>;

/** One payment of a subscription; `transactionId` is null until it is linked to a bank row. */
export const SubscriptionChargeRow = Schema.Struct({
  id: Schema.String,
  transactionId: Schema.NullOr(Schema.String),
  amount: DecimalString,
  currency: Schema.String,
  chargeDate: DateOnly,
  expectedAmount: DecimalString,
  expectedDate: Schema.NullOr(DateOnly),
  matchStatus: Schema.Literals(['matched', 'price_changed', 'date_shifted']),
  createdAt: Timestamp,
});
export type SubscriptionChargeRow = Wire<typeof SubscriptionChargeRow>;

/**
 * `GET /subscriptions/charge-candidates?vendorName=&statementId=`: expense rows
 * not yet a payment of any subscription, the vendor's own first, then newest.
 */
export const SubscriptionChargeCandidates = Schema.Array(
  Schema.Struct({
    transactionId: Schema.String,
    /** The bank's name for the payee; redacted for a private row the viewer cannot read. */
    counterpartyName: Schema.String,
    transactionDate: DateOnly,
    amount: Schema.Number,
    currency: Schema.String,
    /** The row's payee looks like this vendor. */
    matchesVendor: Schema.Boolean,
  }),
);
export type SubscriptionChargeCandidates = Wire<typeof SubscriptionChargeCandidates>;

/** `GET /subscriptions/:id`: the subscription with its charges and decisions. */
export const SubscriptionDetail = Schema.Struct({
  subscription: SubscriptionItem.mapFields(Struct.omit(['category', 'costPerUse'])),
  charges: Schema.Array(SubscriptionChargeRow),
  /**
   * Payees whose new rows become payments of this subscription on their own:
   * those of the rows a person linked to it. `shared` when another active
   * subscription has the same payee, so neither gets its rows automatically.
   */
  autoLinkPayees: Schema.Array(
    Schema.Struct({ payeeId: Schema.String, name: Schema.String, shared: Schema.Boolean }),
  ),
  decisions: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      actorId: Schema.NullOr(Schema.String),
      decision: Schema.Literals(['owner_assigned', 'keep', 'review', 'cancelled', 'price_reduced']),
      ownerId: Schema.NullOr(Schema.String),
      note: Schema.NullOr(Schema.String),
      savingsAmount: Schema.NullOr(DecimalString),
      createdAt: Timestamp,
    }),
  ),
});
export type SubscriptionDetail = Wire<typeof SubscriptionDetail>;
