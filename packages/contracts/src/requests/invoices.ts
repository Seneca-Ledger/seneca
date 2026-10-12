import * as Schema from 'effect/Schema';
import * as Struct from 'effect/Struct';
import {
  Email,
  IsoDateString,
  isAtMostTwoDecimals,
  NumericInput,
  optionalNullable,
} from '../common/requests';
import type { Wire } from '../common/wire';

export const CreateClientBody = Schema.Struct({
  name: Schema.String.check(Schema.isMaxLength(255)),
  email: optionalNullable(Email),
  billingAddress: optionalNullable(Schema.String),
  taxId: optionalNullable(Schema.String.check(Schema.isMaxLength(64))),
  currency: optionalNullable(Schema.String.check(Schema.isMaxLength(3))),
  /** Language of the documents sent to this client, e.g. `de`. */
  locale: optionalNullable(Schema.String.check(Schema.isMaxLength(10))),
  /** False leaves this client out of reminder emails. */
  remindersEnabled: optionalNullable(Schema.Boolean),
  /** "Net 30" for this client; omitted follows the workspace's own term. */
  paymentTermsDays: optionalNullable(
    NumericInput.check(
      Schema.isInt(),
      Schema.isGreaterThanOrEqualTo(0),
      Schema.isLessThanOrEqualTo(365),
    ),
  ),
  /** The billing address in parts, for e-invoices. */
  street: optionalNullable(Schema.String.check(Schema.isMaxLength(255))),
  postalCode: optionalNullable(Schema.String.check(Schema.isMaxLength(16))),
  city: optionalNullable(Schema.String.check(Schema.isMaxLength(120))),
  countryCode: optionalNullable(Schema.String.check(Schema.isPattern(/^[A-Za-z]{2}$/))),
  /** Quoted on every invoice to this client (XRechnung BT-10), e.g. a Leitweg-ID. */
  buyerReference: optionalNullable(Schema.String.check(Schema.isMaxLength(255))),
  /** Goods or services: decides the VAT category of a reverse-charged line. */
  supplyType: optionalNullable(Schema.Literals(['goods', 'services'])),
});
export type CreateClientBody = Wire<typeof CreateClientBody>;

export const UpdateClientBody = CreateClientBody.mapFields(Struct.map(optionalNullable));
export type UpdateClientBody = Wire<typeof UpdateClientBody>;

export const CreditNoteApplicationInput = Schema.Struct({
  invoiceId: Schema.String.check(Schema.isUUID()),
  /** How much of this invoice to credit; everything still creditable by default. */
  amount: optionalNullable(NumericInput.check(Schema.isGreaterThan(0))),
});
export type CreditNoteApplicationInput = Wire<typeof CreditNoteApplicationInput>;

export const CreateCreditNoteBody = Schema.Struct({
  /** Today when omitted. */
  issueDate: optionalNullable(IsoDateString),
  reason: optionalNullable(Schema.String.check(Schema.isMaxLength(2000))),
  /** The invoices this note credits — one document may cover several. */
  applications: Schema.Array(CreditNoteApplicationInput).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(20),
  ),
});
export type CreateCreditNoteBody = Wire<typeof CreateCreditNoteBody>;

export const InvoiceLineItemInput = Schema.Struct({
  description: Schema.String.check(Schema.isMinLength(1)),
  quantity: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0.01)),
  unitPrice: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
  taxRateId: optionalNullable(Schema.String.check(Schema.isUUID())),
  categoryId: optionalNullable(Schema.String.check(Schema.isUUID())),
  /** Unit of measure, UN/ECE Recommendation 20 (C62 one, HUR hour, DAY day…). */
  unitCode: optionalNullable(Schema.String.check(Schema.isPattern(/^[A-Z0-9]{1,3}$/))),
  /** Discount (negative) or surcharge (positive) on quantity × unit price, in percent. */
  adjustmentPercent: optionalNullable(
    Schema.Finite.check(
      isAtMostTwoDecimals,
      Schema.isGreaterThanOrEqualTo(-100),
      Schema.isLessThanOrEqualTo(1000),
    ),
  ),
});
export type InvoiceLineItemInput = Wire<typeof InvoiceLineItemInput>;

export const CreateInvoiceBody = Schema.Struct({
  clientId: Schema.String.check(Schema.isUUID()),
  issueDate: IsoDateString,
  /** Omitted: derived from the issue date and the client's payment terms. */
  dueDate: optionalNullable(IsoDateString),
  currency: optionalNullable(Schema.String.check(Schema.isMaxLength(3))),
  notes: optionalNullable(Schema.String),
  /** True when the line prices already contain their tax. */
  pricesIncludeTax: optionalNullable(Schema.Boolean),
  lineItems: Schema.Array(InvoiceLineItemInput).check(Schema.isMinLength(1)),
  recurrenceInterval: optionalNullable(
    Schema.Literals(['weekly', 'monthly', 'quarterly', 'yearly']),
  ),
  recurrenceEndDate: optionalNullable(IsoDateString),
  /** The buyer's reference for this invoice (XRechnung BT-10); empty uses the client's. */
  buyerReference: optionalNullable(Schema.String.check(Schema.isMaxLength(255))),
  /** When the goods or service were delivered. */
  deliveryDate: optionalNullable(IsoDateString),
});
export type CreateInvoiceBody = Wire<typeof CreateInvoiceBody>;

export const UpdateInvoiceSettingsBody = Schema.Struct({
  prefix: optionalNullable(Schema.String.check(Schema.isMaxLength(20))),
  remindersEnabled: optionalNullable(Schema.Boolean),
  /** Days from the due date: negative before it, positive after. */
  reminderOffsets: optionalNullable(
    Schema.Array(
      NumericInput.check(
        Schema.isInt(),
        Schema.isGreaterThanOrEqualTo(-365),
        Schema.isLessThanOrEqualTo(365),
      ),
    ).check(Schema.isMaxLength(10)),
  ),
  /** Days from issue to due, when a client has no term of its own. */
  paymentTermsDays: optionalNullable(
    NumericInput.check(
      Schema.isInt(),
      Schema.isGreaterThanOrEqualTo(0),
      Schema.isLessThanOrEqualTo(365),
    ),
  ),
  /** Percent of the overdue total, charged as a line on a new invoice. */
  lateFeePercent: optionalNullable(
    NumericInput.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(100)),
  ),
});
export type UpdateInvoiceSettingsBody = Wire<typeof UpdateInvoiceSettingsBody>;

export const UpdateInvoiceBody = CreateInvoiceBody.mapFields(Struct.map(optionalNullable));
export type UpdateInvoiceBody = Wire<typeof UpdateInvoiceBody>;

export const SendInvoiceEmailBody = Schema.Struct({
  /** Overrides the client's stored address for this one send. */
  to: optionalNullable(Email),
  subject: optionalNullable(Schema.String.check(Schema.isMaxLength(500))),
  message: optionalNullable(Schema.String.check(Schema.isMaxLength(5000))),
});
export type SendInvoiceEmailBody = Wire<typeof SendInvoiceEmailBody>;
