import * as Schema from 'effect/Schema';
import * as Struct from 'effect/Struct';
import { optionalNullable } from '../common/requests';
import type { Wire } from '../common/wire';

export const CreateWalletBody = Schema.Struct({
  name: Schema.String,
  accountNumber: optionalNullable(Schema.String),
  bankName: optionalNullable(Schema.String),
  currency: optionalNullable(Schema.String),
  initialBalance: optionalNullable(Schema.Finite),
  /**
   * Whose account this is in the household; `null` means shared. Transactions
   * imported into it start on the same person.
   */
  ownerMemberId: optionalNullable(Schema.String.check(Schema.isUUID())),
});
export type CreateWalletBody = Wire<typeof CreateWalletBody>;

export const UpdateWalletBody = CreateWalletBody.mapFields(Struct.map(optionalNullable)).mapFields(
  Struct.assign({
    isActive: optionalNullable(Schema.Boolean),
  }),
);
export type UpdateWalletBody = Wire<typeof UpdateWalletBody>;

/** `/wallets/:id`: a wallet's uuid. */
export const WalletParams = Schema.Struct({ id: Schema.String.check(Schema.isUUID()) });
export type WalletParams = Wire<typeof WalletParams>;
