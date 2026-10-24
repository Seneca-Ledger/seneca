import * as Schema from 'effect/Schema';
import { Email, optionalNullable } from '../common/requests';
import type { Wire } from '../common/wire';

/** Everything a custom grant can name; mirrors the backend `Permission` enum. */
export const UserPermission = Schema.Literals([
  'statement.view',
  'statement.upload',
  'statement.delete',
  'statement.edit',
  'transaction.view',
  'transaction.edit',
  'transaction.delete',
  'transaction.bulk_update',
  'category.view',
  'category.create',
  'category.edit',
  'category.delete',
  'tag.view',
  'tag.create',
  'tag.edit',
  'tag.delete',
  'branch.view',
  'branch.create',
  'branch.edit',
  'branch.delete',
  'wallet.view',
  'wallet.create',
  'wallet.edit',
  'wallet.delete',
  'payable.view',
  'payable.create',
  'payable.edit',
  'payable.delete',
  'invoice.view',
  'invoice.create',
  'invoice.edit',
  'invoice.delete',
  'client.view',
  'client.create',
  'client.edit',
  'client.delete',
  'report.view',
  'report.export',
  'telegram.view',
  'telegram.connect',
  'telegram.send',
  'user.manage',
  'user.view_all',
  'audit_view',
  'audit_log.view',
  'budget.view',
  'budget.create',
  'budget.edit',
  'budget.delete',
  'goal.view',
  'goal.create',
  'goal.edit',
  'goal.delete',
  'subscription.view',
  'subscription.create',
  'subscription.edit',
  'subscription.delete',
  'api_key.manage',
  'ledger.view',
  'ledger.post',
  'ledger.manage_accounts',
  'workspace_settings.manage',
  'integration.manage',
]);
export type UserPermission = Wire<typeof UserPermission>;

export const CompleteOnboardingBody = Schema.Struct({
  locale: optionalNullable(
    Schema.Literals([
      'ru',
      'en',
      'kk',
      'zh',
      'de',
      'fr',
      'es',
      'uk',
      'pl',
      'sk',
      'pt',
      'tr',
      'it',
      'ja',
      'ko',
      'hi',
      'nl',
      'sv',
      'vi',
      'id',
      'da',
      'nb',
      'nn',
      'fi',
      'is',
      'fo',
      'cs',
      'bg',
      'hr',
      'sr',
      'sl',
      'mk',
      'be',
      'bs',
      'hsb',
    ]),
  ),
  timeZone: optionalNullable(Schema.String.check(Schema.isMaxLength(64))),
  workspaceName: optionalNullable(Schema.String.check(Schema.isMaxLength(255))),
  workspaceCurrency: optionalNullable(Schema.String.check(Schema.isMaxLength(10))),
  workspaceBackgroundImage: optionalNullable(Schema.String.check(Schema.isMaxLength(255))),
});
export type CompleteOnboardingBody = Wire<typeof CompleteOnboardingBody>;

export const DeleteMyAccountBody = Schema.Struct({
  /** Re-authentication: a stolen access token alone must not be able to delete an account. */
  currentPassword: Schema.String.check(Schema.isMinLength(1)),
});
export type DeleteMyAccountBody = Wire<typeof DeleteMyAccountBody>;

/** No `email`: an address changes only through `PATCH /users/me/email` and its confirmation link. */
export const UpdateUserBody = Schema.Struct({
  name: optionalNullable(Schema.String),
  company: optionalNullable(Schema.String),
  role: optionalNullable(Schema.Literals(['admin', 'user', 'viewer'])),
  isActive: optionalNullable(Schema.Boolean),
  permissions: optionalNullable(Schema.Array(UserPermission)),
});
export type UpdateUserBody = Wire<typeof UpdateUserBody>;

export const UpdatePermissionsBody = Schema.Struct({
  permissions: Schema.Array(UserPermission),
});
export type UpdatePermissionsBody = Wire<typeof UpdatePermissionsBody>;

export const AddPermissionBody = Schema.Struct({
  permission: UserPermission,
});
export type AddPermissionBody = Wire<typeof AddPermissionBody>;

export const RemovePermissionBody = Schema.Struct({
  permission: UserPermission,
});
export type RemovePermissionBody = Wire<typeof RemovePermissionBody>;

export const ChangeEmailBody = Schema.Struct({
  email: Email,
  currentPassword: Schema.String,
});
export type ChangeEmailBody = Wire<typeof ChangeEmailBody>;

export const ConfirmEmailChangeBody = Schema.Struct({
  token: Schema.String,
});
export type ConfirmEmailChangeBody = Wire<typeof ConfirmEmailChangeBody>;

export const ChangePasswordBody = Schema.Struct({
  currentPassword: Schema.String,
  newPassword: Schema.String.check(Schema.isMinLength(8)),
});
export type ChangePasswordBody = Wire<typeof ChangePasswordBody>;

export const UpdateMyPreferencesBody = Schema.Struct({
  name: optionalNullable(Schema.String.check(Schema.isMaxLength(120))),
  locale: optionalNullable(
    Schema.Literals([
      'ru',
      'en',
      'kk',
      'zh',
      'de',
      'fr',
      'es',
      'uk',
      'pl',
      'sk',
      'pt',
      'tr',
      'it',
      'ja',
      'ko',
      'hi',
      'nl',
      'sv',
      'vi',
      'id',
      'da',
      'nb',
      'nn',
      'fi',
      'is',
      'fo',
      'cs',
      'bg',
      'hr',
      'sr',
      'sl',
      'mk',
      'be',
      'bs',
      'hsb',
    ]),
  ),
  timeZone: optionalNullable(Schema.String.check(Schema.isMaxLength(64))),
  themePreference: optionalNullable(Schema.Literals(['light', 'dark', 'auto'])),
  dateFormat: optionalNullable(Schema.Literals(['auto', 'dmy', 'mdy', 'ymd'])),
  firstDayOfWeek: optionalNullable(
    Schema.Int.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(6)),
  ),
  uiDensity: optionalNullable(Schema.Literals(['comfortable', 'compact'])),
  reduceMotion: optionalNullable(Schema.Boolean),
  showDailyQuote: optionalNullable(Schema.Boolean),
  mapStylePreference: optionalNullable(Schema.String.check(Schema.isMaxLength(64))),
});
export type UpdateMyPreferencesBody = Wire<typeof UpdateMyPreferencesBody>;

/** `POST /users/me/page-hints`: the hints of `page` were closed up to `version`. */
export const PageHintsSeenBody = Schema.Struct({
  page: Schema.String.check(Schema.isPattern(/^[a-z][a-zA-Z0-9]{0,39}$/)),
  version: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(1000)),
});
export type PageHintsSeenBody = Wire<typeof PageHintsSeenBody>;
