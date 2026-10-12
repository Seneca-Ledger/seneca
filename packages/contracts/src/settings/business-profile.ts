import * as Schema from 'effect/Schema';
import type { Wire } from '../common/wire';

/** Absent, not null, until the profile is saved for the first time. */
const ProfileField = Schema.optional(Schema.NullOr(Schema.String));

/** `GET /business-profile` and `PUT /business-profile`: the issuer side of documents. */
export const BusinessProfileResponse = Schema.Struct({
  legalName: ProfileField,
  registrationId: ProfileField,
  taxId: ProfileField,
  addressLines: ProfileField,
  countryCode: ProfileField,
  email: ProfileField,
  phone: ProfileField,
  website: ProfileField,
  bankName: ProfileField,
  bankAccount: ProfileField,
  bankCode: ProfileField,
  paymentInstructions: ProfileField,
  invoiceFooter: ProfileField,
  logoFile: ProfileField,
  /** Fields an invoice cannot be sent without that are still empty. */
  missingRequired: Schema.Array(Schema.Literals(['legalName', 'addressLines'])),
});
export type BusinessProfileResponse = Wire<typeof BusinessProfileResponse>;
