import * as Schema from 'effect/Schema';
import type { Wire } from '../common/wire';

export const PushKeysInput = Schema.Struct({
  p256dh: Schema.String.check(Schema.isMaxLength(255)),
  auth: Schema.String.check(Schema.isMaxLength(255)),
});
export type PushKeysInput = Wire<typeof PushKeysInput>;

/** The object `PushManager.subscribe()` hands the page, as JSON. */
export const PushSubscriptionBody = Schema.Struct({
  endpoint: Schema.String.check(
    Schema.isPattern(/^https:\/\/\S+$/, { message: 'Expected an https URL' }),
  ),
  keys: PushKeysInput,
  userAgent: Schema.optional(Schema.String.check(Schema.isMaxLength(255))),
});
export type PushSubscriptionBody = Wire<typeof PushSubscriptionBody>;

export const PushUnsubscribeBody = Schema.Struct({
  endpoint: Schema.String,
});
export type PushUnsubscribeBody = Wire<typeof PushUnsubscribeBody>;
