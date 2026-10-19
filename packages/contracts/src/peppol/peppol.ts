import * as Schema from 'effect/Schema';
import { Timestamp, type Wire } from '../common/wire';

/** A format Seneca writes for Peppol: BIS Billing 3.0 (UBL) or XRechnung (CII). */
export const PeppolFormat = Schema.Literals(['peppol_bis', 'xrechnung_cii']);

/** One invoice or credit note sent over Peppol, and how its delivery went. */
export const PeppolTransmission = Schema.Struct({
  id: Schema.String,
  recipient: Schema.String,
  format: PeppolFormat,
  status: Schema.Literals(['pending', 'delivered', 'failed']),
  failure: Schema.NullOr(Schema.String),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type PeppolTransmission = Wire<typeof PeppolTransmission>;

export const PeppolTransmissionList = Schema.Array(PeppolTransmission);
export type PeppolTransmissionList = Wire<typeof PeppolTransmissionList>;

/** Whether a Peppol id is on the network, and which of Seneca's formats it takes. */
export const PeppolLookup = Schema.Struct({
  registered: Schema.Boolean,
  companyName: Schema.NullOr(Schema.String),
  formats: Schema.Array(PeppolFormat),
});
export type PeppolLookup = Wire<typeof PeppolLookup>;
