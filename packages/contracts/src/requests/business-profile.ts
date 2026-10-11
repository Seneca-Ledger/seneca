import * as Schema from 'effect/Schema';
import { Email } from '../common/requests';
import type { Wire } from '../common/wire';

/**
 * Every field is optional: the profile is filled in over time, and `send`
 * refuses only when the fields a document cannot do without are still empty.
 */
export const UpdateBusinessProfileBody = Schema.Struct({
  legalName: Schema.optional(Schema.String.check(Schema.isMaxLength(255))),
  registrationId: Schema.optional(Schema.String.check(Schema.isMaxLength(64))),
  taxId: Schema.optional(Schema.String.check(Schema.isMaxLength(64))),
  addressLines: Schema.optional(Schema.String.check(Schema.isMaxLength(2000))),
  countryCode: Schema.optional(Schema.String.check(Schema.isBetweenLength(2, 2))),
  email: Schema.optional(Email.check(Schema.isMaxLength(255))),
  phone: Schema.optional(Schema.String.check(Schema.isMaxLength(64))),
  website: Schema.optional(Schema.String.check(Schema.isMaxLength(255))),
  bankName: Schema.optional(Schema.String.check(Schema.isMaxLength(255))),
  bankAccount: Schema.optional(Schema.String.check(Schema.isMaxLength(64))),
  bankCode: Schema.optional(Schema.String.check(Schema.isMaxLength(32))),
  paymentInstructions: Schema.optional(Schema.String.check(Schema.isMaxLength(2000))),
  invoiceFooter: Schema.optional(Schema.String.check(Schema.isMaxLength(2000))),
});
export type UpdateBusinessProfileBody = Wire<typeof UpdateBusinessProfileBody>;
