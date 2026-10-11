import * as Schema from 'effect/Schema';
import { Timestamp, type Wire } from '../common/wire';

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
    events: Schema.Array(
      Schema.Literals(['transaction.created', 'statement.processed', 'receipt.approved']),
    ),
    isActive: Schema.Boolean,
    createdAt: Timestamp,
  }),
);
export type WebhookSubscriptionList = Wire<typeof WebhookSubscriptionList>;
