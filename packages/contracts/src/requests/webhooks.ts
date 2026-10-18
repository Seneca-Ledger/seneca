import * as Schema from 'effect/Schema';
import * as Struct from 'effect/Struct';
import { optionalNullable, Url } from '../common/requests';
import type { Wire } from '../common/wire';
import { WebhookEventName } from '../webhooks/webhooks';

export const CreateWebhookEndpointBody = Schema.Struct({
  name: Schema.String.check(Schema.isBetweenLength(1, 255)),
  isActive: optionalNullable(Schema.Boolean),
  defaultWalletId: optionalNullable(Schema.String.check(Schema.isUUID())),
  defaultBranchId: optionalNullable(Schema.String.check(Schema.isUUID())),
});
export type CreateWebhookEndpointBody = Wire<typeof CreateWebhookEndpointBody>;

export const UpdateWebhookEndpointBody = CreateWebhookEndpointBody.mapFields(
  Struct.map(optionalNullable),
);
export type UpdateWebhookEndpointBody = Wire<typeof UpdateWebhookEndpointBody>;

export const WebhookStatementUploadBody = Schema.Struct({
  fileBase64: optionalNullable(Schema.String.check(Schema.isPattern(/^[A-Za-z0-9+/]*={0,2}$/))),
  fileName: optionalNullable(Schema.String),
  walletId: optionalNullable(Schema.String.check(Schema.isUUID())),
  branchId: optionalNullable(Schema.String.check(Schema.isUUID())),
});
export type WebhookStatementUploadBody = Wire<typeof WebhookStatementUploadBody>;

export const WebhookReceiptUploadBody = Schema.Struct({
  fileBase64: optionalNullable(Schema.String.check(Schema.isPattern(/^[A-Za-z0-9+/]*={0,2}$/))),
  fileName: optionalNullable(Schema.String),
  language: optionalNullable(Schema.String),
  walletId: optionalNullable(Schema.String.check(Schema.isUUID())),
});
export type WebhookReceiptUploadBody = Wire<typeof WebhookReceiptUploadBody>;

export const CreateWebhookSubscriptionBody = Schema.Struct({
  name: Schema.String.check(Schema.isBetweenLength(1, 255)),
  url: Url,
  secret: Schema.String.check(Schema.isBetweenLength(16, 255)),
  events: Schema.Array(WebhookEventName),
  isActive: optionalNullable(Schema.Boolean),
});
export type CreateWebhookSubscriptionBody = Wire<typeof CreateWebhookSubscriptionBody>;

export const UpdateWebhookSubscriptionBody = CreateWebhookSubscriptionBody.mapFields(
  Struct.map(optionalNullable),
);
export type UpdateWebhookSubscriptionBody = Wire<typeof UpdateWebhookSubscriptionBody>;
