import * as Schema from 'effect/Schema';
import { NumericInput } from '../common/requests';
import type { Wire } from '../common/wire';

/**
 * These bodies used to be typed `Record<string, unknown>`, which makes the
 * global ValidationPipe a no-op: with an `Object` metatype there is nothing for
 * `whitelist`/`forbidNonWhitelisted` to check against, so unknown properties
 * flowed through untouched.
 *
 * The service still coerces every field it reads (requiredString, positiveNumber
 * and friends) and builds its config objects from named fields, so this is the
 * boundary check those helpers never replaced — it rejects unknown properties
 * and returns a proper 400 instead of surfacing a coercion error later.
 */
export const SaveAiSettingsBody = Schema.Struct({
  enabled: Schema.optional(Schema.Boolean),
  baseUrl: Schema.String,
  model: Schema.String,
  apiKey: Schema.optional(Schema.String),
  timeoutMs: Schema.optional(NumericInput.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1))),
});
export type SaveAiSettingsBody = Wire<typeof SaveAiSettingsBody>;

export const SaveLocalCategorizationBody = Schema.Struct({
  enabled: Schema.optional(Schema.Boolean),
  modelId: Schema.optional(Schema.String),
  threshold: Schema.optional(
    NumericInput.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(1)),
  ),
  localModelPath: Schema.optional(Schema.String),
});
export type SaveLocalCategorizationBody = Wire<typeof SaveLocalCategorizationBody>;

export const TestLocalCategorizationBody = Schema.Struct({
  merchantName: Schema.String,
  categories: Schema.optional(Schema.Array(Schema.String)),
});
export type TestLocalCategorizationBody = Wire<typeof TestLocalCategorizationBody>;

export const SaveSmtpSettingsBody = Schema.Struct({
  host: Schema.String,
  port: Schema.optional(
    NumericInput.check(
      Schema.isInt(),
      Schema.isGreaterThanOrEqualTo(1),
      Schema.isLessThanOrEqualTo(65535),
    ),
  ),
  secure: Schema.optional(Schema.Boolean),
  user: Schema.optional(Schema.String),
  pass: Schema.optional(Schema.String),
  from: Schema.String,
  replyTo: Schema.optional(Schema.String),
  timeoutMs: Schema.optional(NumericInput.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1))),
});
export type SaveSmtpSettingsBody = Wire<typeof SaveSmtpSettingsBody>;

export const SaveTelegramSettingsBody = Schema.Struct({
  botToken: Schema.optional(Schema.String),
  timeoutMs: Schema.optional(NumericInput.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1))),
});
export type SaveTelegramSettingsBody = Wire<typeof SaveTelegramSettingsBody>;

export const SaveAppSettingsBody = Schema.Struct({
  publicUrl: Schema.String,
});
export type SaveAppSettingsBody = Wire<typeof SaveAppSettingsBody>;
