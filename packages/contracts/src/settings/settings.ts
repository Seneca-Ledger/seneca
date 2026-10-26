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

const SettingsSource = Schema.Literals(['workspace', 'instance', 'env', 'disabled']);

/** `GET /settings/notifications/telegram`: never the token itself. */
export const TelegramBotStatus = Schema.Struct({
  connected: Schema.Boolean,
  status: Schema.String,
  source: SettingsSource,
  settings: Schema.Struct({
    timeoutMs: Schema.Number,
    botTokenConfigured: Schema.Boolean,
    /** A bot every workspace can use: saved by an instance admin, or TELEGRAM_BOT_TOKEN. */
    sharedBot: Schema.Boolean,
  }),
});
export type TelegramBotStatus = Wire<typeof TelegramBotStatus>;

/** `GET /settings/instance/telegram` (instance admins): where the shared bot comes from. */
export const InstanceTelegramBotStatus = Schema.Struct({
  source: Schema.Literals(['instance', 'env', 'disabled']),
});
export type InstanceTelegramBotStatus = Wire<typeof InstanceTelegramBotStatus>;

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

/** `POST /telegram/send-report`: the report row, sent now or already sent for that day. */
export const TelegramReportSent = Schema.Struct({
  status: Schema.Literals(['sent', 'already_sent']),
  report: TelegramReport,
});
export type TelegramReportSent = Wire<typeof TelegramReportSent>;

/**
 * `POST /telegram/link`: a t.me link that opens the bot with a one-time code.
 * Pressing Start in Telegram sends the code back and connects the chat.
 */
export const TelegramLink = Schema.Struct({
  url: Schema.String,
  expiresAt: Timestamp,
});
export type TelegramLink = Wire<typeof TelegramLink>;

/** `GET /telegram/connection`: whether the user's chat is connected, and to this workspace. */
export const TelegramConnection = Schema.Struct({
  connected: Schema.Boolean,
  inThisWorkspace: Schema.Boolean,
});
export type TelegramConnection = Wire<typeof TelegramConnection>;

/** `GET /push/public-key`: the VAPID key, or `enabled: false` without one. */
export const PushPublicKey = Schema.Struct({
  enabled: Schema.Boolean,
  publicKey: Schema.NullOr(Schema.String),
});
export type PushPublicKey = Wire<typeof PushPublicKey>;

/** `GET /push/subscriptions`: the browsers the person receives pushes on. */
export const PushSubscriptionList = Schema.Array(
  Schema.Struct({
    id: Schema.String,
    endpoint: Schema.String,
    userAgent: Schema.NullOr(Schema.String),
    createdAt: Timestamp,
    lastUsedAt: Schema.NullOr(Timestamp),
  }),
);
export type PushSubscriptionList = Wire<typeof PushSubscriptionList>;

/** `POST /push/subscriptions`. */
export const PushSubscriptionCreated = Schema.Struct({
  id: Schema.String,
  endpoint: Schema.String,
});
export type PushSubscriptionCreated = Wire<typeof PushSubscriptionCreated>;

/** `POST /exchange-rates/manual`: the rate stored for that day. */
export const ManualExchangeRate = Schema.Struct({
  from: Schema.String,
  to: Schema.String,
  rate: Schema.Number,
  rateDate: DateOnly,
});
export type ManualExchangeRate = Wire<typeof ManualExchangeRate>;

/** `POST /exchange-rates/convert`: one result per item, in order. */
export const BulkConversion = Schema.Struct({
  targetCurrency: Schema.String,
  results: Schema.Array(
    Schema.Struct({ converted: Schema.Number, rate: Schema.Number, source: Schema.String }),
  ),
});
export type BulkConversion = Wire<typeof BulkConversion>;

/** `GET /exchange-rates`: one rate for a date, and whether it is stale or missing. */
export const ExchangeRateQuote = Schema.Struct({
  from: Schema.String,
  to: Schema.String,
  rate: Schema.Number,
  date: Schema.NullOr(Schema.String),
  rateDate: Schema.NullOr(Schema.String),
  stale: Schema.Boolean,
  missing: Schema.Boolean,
});
export type ExchangeRateQuote = Wire<typeof ExchangeRateQuote>;

/** `GET /integrations/simplefin/status`: the bank feed and its accounts. Never the access URL. */
export const BankSyncStatus = Schema.Struct({
  connected: Schema.Boolean,
  status: Schema.Literals(['connected', 'disconnected', 'needs_reauth']),
  settings: Schema.NullOr(
    Schema.Struct({
      provider: Schema.String,
      autoSync: Schema.Boolean,
      accounts: Schema.Array(
        Schema.Struct({
          id: Schema.String,
          name: Schema.String,
          org: Schema.String,
          currency: Schema.String,
          enabled: Schema.Boolean,
          walletId: Schema.NullOr(Schema.String),
          lastSyncAt: Schema.NullOr(Schema.String),
          balance: Schema.NullOr(Schema.Number),
          balanceDate: Schema.NullOr(Schema.String),
        }),
      ),
      lastSyncAt: Schema.NullOr(Schema.String),
      lastError: Schema.NullOr(Schema.String),
    }),
  ),
});
export type BankSyncStatus = Wire<typeof BankSyncStatus>;

/** `POST /integrations/simplefin/sync`: rows and statements made, per account. */
export const BankSyncResult = Schema.Struct({
  ok: Schema.Boolean,
  imported: Schema.Number,
  statements: Schema.Number,
  accounts: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      imported: Schema.Number,
      statementId: Schema.NullOr(Schema.String),
      /** Why this account could not be read; the others still are. */
      error: Schema.optional(Schema.String),
    }),
  ),
});
export type BankSyncResult = Wire<typeof BankSyncResult>;
