import * as Schema from 'effect/Schema';
import { optionalNullable, Url } from '../common/requests';
import type { Wire } from '../common/wire';

const Uuid = Schema.String.check(Schema.isUUID());
const ProviderKey = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(64));
const ProviderAccountId = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(256));
const Label = Schema.String.check(Schema.isMaxLength(120));
const Country = Schema.String.check(Schema.isMinLength(2), Schema.isMaxLength(2));

/** `POST /integrations/bank-sync/connections/token`: SimpleFIN style. */
export const ConnectBankSyncTokenBody = Schema.Struct({
  /** Which provider the token belongs to, e.g. `simplefin`. */
  provider: ProviderKey,
  /** The one-time token the provider shows after "new connection". */
  setupToken: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(4096)),
  label: optionalNullable(Label),
});
export type ConnectBankSyncTokenBody = Wire<typeof ConnectBankSyncTokenBody>;

/** `POST /integrations/bank-sync/connections/redirect`: Enable Banking style. */
export const CreateBankSyncRedirectBody = Schema.Struct({
  provider: ProviderKey,
  /** The application credentials the user holds with the provider (an id, a PEM key). */
  secrets: Schema.Record(
    Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(64)),
    Schema.String.check(Schema.isMaxLength(16384)),
  ),
  label: optionalNullable(Label),
});
export type CreateBankSyncRedirectBody = Wire<typeof CreateBankSyncRedirectBody>;

/** `POST /integrations/bank-sync/connections/:id/links/begin`. */
export const BeginBankSyncLinkBody = Schema.Struct({
  /** The bank, named as the provider names it. */
  institution: ProviderAccountId,
  country: Country,
  /** Where the provider sends the user back; the provider accepts only URLs registered for the application. */
  redirectUrl: Url.check(Schema.isMaxLength(2048)),
  /** The consent ceiling the bank advertises; passing it buys a consent longer than the default. */
  maxConsentValiditySeconds: optionalNullable(
    Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  ),
});
export type BeginBankSyncLinkBody = Wire<typeof BeginBankSyncLinkBody>;

/** `POST /integrations/bank-sync/connections/:id/links/complete`. */
export const CompleteBankSyncLinkBody = Schema.Struct({
  code: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(4096)),
  state: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(128)),
});
export type CompleteBankSyncLinkBody = Wire<typeof CompleteBankSyncLinkBody>;

/** `PATCH /integrations/bank-sync/connections/:id`. */
export const UpdateBankSyncConnectionBody = Schema.Struct({
  label: optionalNullable(Label),
  autoSync: optionalNullable(Schema.Boolean),
});
export type UpdateBankSyncConnectionBody = Wire<typeof UpdateBankSyncConnectionBody>;

/** `PATCH /integrations/bank-sync/connections/:id/accounts/:accountId`. */
export const UpdateBankSyncAccountBody = Schema.Struct({
  enabled: optionalNullable(Schema.Boolean),
  /** The wallet the pulled rows land in; null detaches the feed. */
  walletId: optionalNullable(Uuid),
});
export type UpdateBankSyncAccountBody = Wire<typeof UpdateBankSyncAccountBody>;

/** `POST /integrations/bank-sync/feeds/switch`: moves a wallet's feed, keeping its history. */
export const SwitchBankSyncFeedBody = Schema.Struct({
  walletId: Uuid,
  toConnectionId: Uuid,
  toAccountId: ProviderAccountId,
});
export type SwitchBankSyncFeedBody = Wire<typeof SwitchBankSyncFeedBody>;

export const BankSyncConnectionParams = Schema.Struct({ id: Uuid });
export type BankSyncConnectionParams = Wire<typeof BankSyncConnectionParams>;

export const BankSyncAccountParams = Schema.Struct({ id: Uuid, accountId: ProviderAccountId });
export type BankSyncAccountParams = Wire<typeof BankSyncAccountParams>;

/** `GET /integrations/bank-sync/connections/:id/institutions`. */
export const BankSyncInstitutionsQuery = Schema.Struct({ country: Country });
export type BankSyncInstitutionsQuery = Wire<typeof BankSyncInstitutionsQuery>;
