import * as Schema from 'effect/Schema';
import { optionalNullable } from '../common/requests';
import type { Wire } from '../common/wire';

export const ConnectBankSyncBody = Schema.Struct({
  /** The one-time token SimpleFIN Bridge shows after "New connection". */
  setupToken: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(4096)),
});
export type ConnectBankSyncBody = Wire<typeof ConnectBankSyncBody>;

export const BankSyncAccountSettingInput = Schema.Struct({
  id: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(256)),
  enabled: optionalNullable(Schema.Boolean),
  /** The wallet the pulled rows land in; null detaches. */
  walletId: optionalNullable(Schema.String.check(Schema.isUUID())),
});
export type BankSyncAccountSettingInput = Wire<typeof BankSyncAccountSettingInput>;

export const UpdateBankSyncSettingsBody = Schema.Struct({
  autoSync: optionalNullable(Schema.Boolean),
  accounts: optionalNullable(Schema.Array(BankSyncAccountSettingInput)),
});
export type UpdateBankSyncSettingsBody = Wire<typeof UpdateBankSyncSettingsBody>;
