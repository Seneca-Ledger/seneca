import * as Schema from 'effect/Schema';
import { Timestamp, type Wire } from '../common/wire';

/** Every event an outbound webhook subscription can listen to. */
export const WebhookEventName = Schema.Literals([
  'transaction.created',
  'transactions.imported',
  'statement.uploaded',
  'statement.processed',
  'statement.failed',
  'transactions.uncategorized',
  'receipt.approved',
  'receipt.needs_review',
  'invoice.paid',
  'invoice.overdue',
  'bill.paid',
  'bill.overdue',
  'budget.exceeded',
  'tax.deadline.upcoming',
  'tax.threshold.reached',
]);
export type WebhookEventName = Wire<typeof WebhookEventName>;

/** The events grouped as the webhooks settings show them. */
export const WEBHOOK_EVENT_GROUPS = {
  transactions: ['transaction.created', 'transactions.imported'],
  statements: ['statement.uploaded', 'statement.processed', 'statement.failed'],
  review: ['transactions.uncategorized', 'receipt.needs_review', 'receipt.approved'],
  payables: ['invoice.paid', 'invoice.overdue', 'bill.paid', 'bill.overdue'],
  budgets: ['budget.exceeded'],
  taxes: ['tax.deadline.upcoming', 'tax.threshold.reached'],
} as const satisfies Record<string, readonly WebhookEventName[]>;

/** `GET /webhook-endpoints`: inbound endpoints, the token shown only as a preview. */
export const WebhookEndpointList = Schema.Array(
  Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    tokenPreview: Schema.String,
    isActive: Schema.Boolean,
    defaultWalletId: Schema.NullOr(Schema.String),
    defaultBranchId: Schema.NullOr(Schema.String),
    createdAt: Timestamp,
  }),
);
export type WebhookEndpointList = Wire<typeof WebhookEndpointList>;

/** `GET /webhook-subscriptions`: outbound deliveries. Never the signing secret. */
export const WebhookSubscriptionList = Schema.Array(
  Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    url: Schema.String,
    events: Schema.Array(WebhookEventName),
    isActive: Schema.Boolean,
    createdAt: Timestamp,
  }),
);
export type WebhookSubscriptionList = Wire<typeof WebhookSubscriptionList>;

/** `POST /webhook-endpoints`: the only answer that carries the whole token. */
export const CreatedWebhookEndpoint = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  token: Schema.String,
  isActive: Schema.Boolean,
  defaultWalletId: Schema.NullOr(Schema.String),
  defaultBranchId: Schema.NullOr(Schema.String),
  createdAt: Timestamp,
});
export type CreatedWebhookEndpoint = Wire<typeof CreatedWebhookEndpoint>;
