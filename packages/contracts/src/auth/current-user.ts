import * as Schema from 'effect/Schema';
import { Timestamp, type Wire } from '../common/wire';

export const UserRole = Schema.Literals(['admin', 'user', 'viewer']);
export type UserRole = Wire<typeof UserRole>;

export const DateFormatPreference = Schema.Literals(['auto', 'dmy', 'mdy', 'ymd']);
export type DateFormatPreference = Wire<typeof DateFormatPreference>;

export const ThemePreference = Schema.Literals(['light', 'dark', 'auto']);
export type ThemePreference = Wire<typeof ThemePreference>;

/**
 * `GET /auth/me`: the signed-in user as the app shell needs them. Built
 * field by field on the backend, so credentials and bookkeeping columns
 * (token version, OAuth ids, 2FA state) never ride along.
 */
export const CurrentUser = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  name: Schema.String,
  role: UserRole,
  /** The user's home workspace, not necessarily the one open in the app. */
  workspaceId: Schema.NullOr(Schema.String),
  permissions: Schema.NullOr(Schema.Array(Schema.String)),
  telegramId: Schema.NullOr(Schema.String),
  telegramChatId: Schema.NullOr(Schema.String),
  locale: Schema.String,
  timeZone: Schema.NullOr(Schema.String),
  dateFormat: DateFormatPreference,
  firstDayOfWeek: Schema.NullOr(Schema.Number),
  uiDensity: Schema.Literals(['comfortable', 'compact']),
  reduceMotion: Schema.Boolean,
  /** Daily-quote banner above the pages. */
  showDailyQuote: Schema.Boolean,
  themePreference: ThemePreference,
  /** Tile style picked on receipt maps; null follows the server default. */
  mapStylePreference: Schema.NullOr(Schema.String),
  lastLogin: Schema.NullOr(Timestamp),
  avatarUrl: Schema.NullOr(Schema.String),
  onboardingCompletedAt: Schema.NullOr(Timestamp),
  /** When the welcome tutorial was closed; null opens it after sign-up. */
  welcomeTutorialSeenAt: Schema.NullOr(Timestamp),
});
export type CurrentUser = Wire<typeof CurrentUser>;
