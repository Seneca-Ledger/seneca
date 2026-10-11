import * as Schema from 'effect/Schema';
import { Email, optionalNullable } from '../common/requests';
import type { Wire } from '../common/wire';

/**
 * Every field is optional: the profile is filled in over time, and `send`
 * refuses only when the fields a document cannot do without are still empty.
 */
export const UpdateBusinessProfileBody = Schema.Struct({
  legalName: optionalNullable(Schema.String.check(Schema.isMaxLength(255))),
  registrationId: optionalNullable(Schema.String.check(Schema.isMaxLength(64))),
  taxId: optionalNullable(Schema.String.check(Schema.isMaxLength(64))),
  addressLines: optionalNullable(Schema.String.check(Schema.isMaxLength(2000))),
  countryCode: optionalNullable(Schema.String.check(Schema.isBetweenLength(2, 2))),
  email: optionalNullable(Email.check(Schema.isMaxLength(255))),
  phone: optionalNullable(Schema.String.check(Schema.isMaxLength(64))),
  website: optionalNullable(Schema.String.check(Schema.isMaxLength(255))),
  bankName: optionalNullable(Schema.String.check(Schema.isMaxLength(255))),
  bankAccount: optionalNullable(Schema.String.check(Schema.isMaxLength(64))),
  bankCode: optionalNullable(Schema.String.check(Schema.isMaxLength(32))),
  paymentInstructions: optionalNullable(Schema.String.check(Schema.isMaxLength(2000))),
  invoiceFooter: optionalNullable(Schema.String.check(Schema.isMaxLength(2000))),
});
export type UpdateBusinessProfileBody = Wire<typeof UpdateBusinessProfileBody>;
