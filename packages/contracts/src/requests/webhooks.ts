import * as Schema from 'effect/Schema';
import * as Struct from 'effect/Struct';
import { Url } from '../common/requests';
import type { Wire } from '../common/wire';

export const CreateWebhookEndpointBody = Schema.Struct({
  name: Schema.String.check(Schema.isBetweenLength(1, 255)),
  isActive: Schema.optional(Schema.Boolean),
  defaultWalletId: Schema.optional(Schema.String.check(Schema.isUUID())),
  defaultBranchId: Schema.optional(Schema.String.check(Schema.isUUID())),
});
export type CreateWebhookEndpointBody = Wire<typeof CreateWebhookEndpointBody>;

export const UpdateWebhookEndpointBody = CreateWebhookEndpointBody.mapFields(
  Struct.map(Schema.optional),
);
export type UpdateWebhookEndpointBody = Wire<typeof UpdateWebhookEndpointBody>;

export const WebhookStatementUploadBody = Schema.Struct({
  fileBase64: Schema.optional(Schema.String.check(Schema.isPattern(/^[A-Za-z0-9+/]*={0,2}$/))),
  fileName: Schema.optional(Schema.String),
  walletId: Schema.optional(Schema.String.check(Schema.isUUID())),
  branchId: Schema.optional(Schema.String.check(Schema.isUUID())),
});
export type WebhookStatementUploadBody = Wire<typeof WebhookStatementUploadBody>;

export const WebhookReceiptUploadBody = Schema.Struct({
  fileBase64: Schema.optional(Schema.String.check(Schema.isPattern(/^[A-Za-z0-9+/]*={0,2}$/))),
  fileName: Schema.optional(Schema.String),
  language: Schema.optional(Schema.String),
  walletId: Schema.optional(Schema.String.check(Schema.isUUID())),
});
export type WebhookReceiptUploadBody = Wire<typeof WebhookReceiptUploadBody>;

export const CreateWebhookSubscriptionBody = Schema.Struct({
  name: Schema.String.check(Schema.isBetweenLength(1, 255)),
  url: Url,
  secret: Schema.String.check(Schema.isBetweenLength(16, 255)),
  events: Schema.Array(
    Schema.Literals(['transaction.created', 'statement.processed', 'receipt.approved']),
  ),
  isActive: Schema.optional(Schema.Boolean),
});
export type CreateWebhookSubscriptionBody = Wire<typeof CreateWebhookSubscriptionBody>;

export const UpdateWebhookSubscriptionBody = CreateWebhookSubscriptionBody.mapFields(
  Struct.map(Schema.optional),
);
export type UpdateWebhookSubscriptionBody = Wire<typeof UpdateWebhookSubscriptionBody>;
