import * as Schema from 'effect/Schema';
import { Timestamp, type Wire } from '../common/wire';
import { ApiKeyScope } from '../requests/api-keys';

/** One row of `GET /api-keys`: never the secret, never its hash. */
export const ApiKeyItem = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  prefix: Schema.String,
  lastUsedAt: Schema.NullOr(Timestamp),
  expiresAt: Schema.NullOr(Timestamp),
  revokedAt: Schema.NullOr(Timestamp),
  createdAt: Timestamp,
  /** null = a key made before scopes existed: the owner's full reach. */
  scopes: Schema.NullOr(Schema.Array(Schema.String)),
});
export type ApiKeyItem = Wire<typeof ApiKeyItem>;

export const ApiKeyList = Schema.Array(ApiKeyItem);
export type ApiKeyList = Wire<typeof ApiKeyList>;

/** `GET /api-keys/scopes`: what a new key may carry, grouped and preset. */
export const ApiKeyScopes = Schema.Struct({
  all: Schema.Array(ApiKeyScope),
  /** By the area before the dot, for a checkbox list. */
  groups: Schema.Record(Schema.String, Schema.Array(ApiKeyScope)),
  presets: Schema.Struct({ read: Schema.Array(ApiKeyScope), write: Schema.Array(ApiKeyScope) }),
});
export type ApiKeyScopes = Wire<typeof ApiKeyScopes>;

/** `POST /api-keys`: the only time the key itself is shown. */
export const CreatedApiKey = Schema.Struct({
  id: Schema.String,
  key: Schema.String,
  prefix: Schema.String,
  name: Schema.String,
  scopes: Schema.NullOr(Schema.Array(Schema.String)),
  expiresAt: Schema.NullOr(Timestamp),
  createdAt: Timestamp,
});
export type CreatedApiKey = Wire<typeof CreatedApiKey>;
