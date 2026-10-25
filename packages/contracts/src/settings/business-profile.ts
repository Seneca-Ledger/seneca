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
  /** The address in parts, for e-invoices (XRechnung). */
  street: ProfileField,
  postalCode: ProfileField,
  city: ProfileField,
  /** Steuernummer, apart from the VAT id in `taxId`. */
  taxNumber: ProfileField,
  /** Who the buyer can ask about an invoice. */
  contactName: ProfileField,
  logoFile: ProfileField,
  /** Fields an invoice cannot be sent without that are still empty. */
  missingRequired: Schema.Array(Schema.Literals(['legalName', 'addressLines'])),
});
export type BusinessProfileResponse = Wire<typeof BusinessProfileResponse>;

/** `POST /business-profile/logo`: the stored file and where it is served. */
export const BusinessProfileLogo = Schema.Struct({
  logoFile: Schema.String,
  logoUrl: Schema.String,
});
export type BusinessProfileLogo = Wire<typeof BusinessProfileLogo>;

/** `DELETE /business-profile/logo`. */
export const BusinessProfileLogoCleared = Schema.Struct({ logoFile: Schema.Null });
export type BusinessProfileLogoCleared = Wire<typeof BusinessProfileLogoCleared>;
