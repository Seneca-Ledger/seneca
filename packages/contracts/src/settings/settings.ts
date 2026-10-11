import * as Schema from 'effect/Schema';
import { DateOnly, Timestamp, type Wire } from '../common/wire';

/** `GET /exchange-rates/coverage`: which currencies in the books have a rate. */
export const ExchangeRateCoverage = Schema.Struct({
  /** The workspace currency everything converts into. */
  currency: Schema.String,
  currencies: Schema.Array(
    Schema.Struct({
      currency: Schema.String,
      rate: Schema.NullOr(Schema.Number),
      rateDate: Schema.NullOr(Schema.String),
      stale: Schema.Boolean,
      rows: Schema.Number,
    }),
  ),
  missing: Schema.Array(Schema.String),
});
export type ExchangeRateCoverage = Wire<typeof ExchangeRateCoverage>;

export const NotificationChannelSet = Schema.Struct({
  inApp: Schema.Boolean,
  email: Schema.Boolean,
  telegram: Schema.Boolean,
  /** Rows written before the push channel existed have no key. */
  push: Schema.optional(Schema.Boolean),
});
export type NotificationChannelSet = Wire<typeof NotificationChannelSet>;

/** `GET /notifications/preferences`: the per-event channel matrix and delivery timing. */
export const NotificationPreferences = Schema.Struct({
  channels: Schema.Record(Schema.String, NotificationChannelSet),
  digestMode: Schema.Literals(['instant', 'daily', 'weekly']),
  quietHoursStart: Schema.NullOr(Schema.Number),
  quietHoursEnd: Schema.NullOr(Schema.Number),
  lastDigestAt: Schema.NullOr(Timestamp),
  updatedAt: Timestamp,
});
export type NotificationPreferences = Wire<typeof NotificationPreferences>;

const SettingsSource = Schema.Literals(['workspace', 'env', 'disabled']);

/** `GET /settings/local-categorization`. */
export const LocalCategorizationStatus = Schema.Struct({
  connected: Schema.Boolean,
  status: Schema.String,
  source: SettingsSource,
  settings: Schema.Struct({
    enabled: Schema.Boolean,
    modelId: Schema.String,
    threshold: Schema.Number,
    localModelPath: Schema.NullOr(Schema.String),
    modelInstalled: Schema.Boolean,
  }),
});
export type LocalCategorizationStatus = Wire<typeof LocalCategorizationStatus>;

/** `GET /settings/notifications/telegram`: never the token itself. */
export const TelegramBotStatus = Schema.Struct({
  connected: Schema.Boolean,
  status: Schema.String,
  source: SettingsSource,
  settings: Schema.Struct({
    timeoutMs: Schema.Number,
    botTokenConfigured: Schema.Boolean,
  }),
});
export type TelegramBotStatus = Wire<typeof TelegramBotStatus>;

export const TelegramReport = Schema.Struct({
  id: Schema.String,
  chatId: Schema.String,
  reportType: Schema.Literals(['daily', 'monthly', 'custom']),
  reportDate: DateOnly,
  sentAt: Schema.NullOr(Timestamp),
  status: Schema.Literals(['pending', 'sent', 'failed']),
  messageId: Schema.NullOr(Schema.String),
  createdAt: Timestamp,
});
export type TelegramReport = Wire<typeof TelegramReport>;

/** `GET /telegram/reports`. */
export const TelegramReportPage = Schema.Struct({
  data: Schema.Array(TelegramReport),
  total: Schema.Number,
  page: Schema.Number,
  limit: Schema.Number,
});
export type TelegramReportPage = Wire<typeof TelegramReportPage>;

/** `GET /push/public-key`: the VAPID key, or `enabled: false` without one. */
export const PushPublicKey = Schema.Struct({
  enabled: Schema.Boolean,
  publicKey: Schema.NullOr(Schema.String),
});
export type PushPublicKey = Wire<typeof PushPublicKey>;
