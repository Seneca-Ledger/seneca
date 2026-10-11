import * as Schema from 'effect/Schema';
import * as Struct from 'effect/Struct';
import { Email, IsoDateString, NumericInput } from '../common/requests';
import type { Wire } from '../common/wire';

export const CreateClientBody = Schema.Struct({
  name: Schema.String.check(Schema.isMaxLength(255)),
  email: Schema.optional(Email),
  billingAddress: Schema.optional(Schema.String),
  taxId: Schema.optional(Schema.String.check(Schema.isMaxLength(64))),
  currency: Schema.optional(Schema.String.check(Schema.isMaxLength(3))),
  /** Language of the documents sent to this client, e.g. `de`. */
  locale: Schema.optional(Schema.String.check(Schema.isMaxLength(10))),
  /** False leaves this client out of reminder emails. */
  remindersEnabled: Schema.optional(Schema.Boolean),
  /** "Net 30" for this client; omitted follows the workspace's own term. */
  paymentTermsDays: Schema.optional(
    NumericInput.check(
      Schema.isInt(),
      Schema.isGreaterThanOrEqualTo(0),
      Schema.isLessThanOrEqualTo(365),
    ),
  ),
});
export type CreateClientBody = Wire<typeof CreateClientBody>;

export const UpdateClientBody = CreateClientBody.mapFields(Struct.map(Schema.optional));
export type UpdateClientBody = Wire<typeof UpdateClientBody>;

export const CreditNoteApplicationInput = Schema.Struct({
  invoiceId: Schema.String.check(Schema.isUUID()),
  /** How much of this invoice to credit; everything still creditable by default. */
  amount: Schema.optional(NumericInput.check(Schema.isGreaterThan(0))),
});
export type CreditNoteApplicationInput = Wire<typeof CreditNoteApplicationInput>;

export const CreateCreditNoteBody = Schema.Struct({
  /** Today when omitted. */
  issueDate: Schema.optional(IsoDateString),
  reason: Schema.optional(Schema.String.check(Schema.isMaxLength(2000))),
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
  taxRateId: Schema.optional(Schema.String.check(Schema.isUUID())),
  categoryId: Schema.optional(Schema.String.check(Schema.isUUID())),
});
export type InvoiceLineItemInput = Wire<typeof InvoiceLineItemInput>;

export const CreateInvoiceBody = Schema.Struct({
  clientId: Schema.String.check(Schema.isUUID()),
  issueDate: IsoDateString,
  /** Omitted: derived from the issue date and the client's payment terms. */
  dueDate: Schema.optional(IsoDateString),
  currency: Schema.optional(Schema.String.check(Schema.isMaxLength(3))),
  notes: Schema.optional(Schema.String),
  /** True when the line prices already contain their tax. */
  pricesIncludeTax: Schema.optional(Schema.Boolean),
  lineItems: Schema.Array(InvoiceLineItemInput).check(Schema.isMinLength(1)),
  recurrenceInterval: Schema.optional(
    Schema.Literals(['weekly', 'monthly', 'quarterly', 'yearly']),
  ),
  recurrenceEndDate: Schema.optional(IsoDateString),
});
export type CreateInvoiceBody = Wire<typeof CreateInvoiceBody>;

export const UpdateInvoiceSettingsBody = Schema.Struct({
  prefix: Schema.optional(Schema.String.check(Schema.isMaxLength(20))),
  remindersEnabled: Schema.optional(Schema.Boolean),
  /** Days from the due date: negative before it, positive after. */
  reminderOffsets: Schema.optional(
    Schema.Array(
      NumericInput.check(
        Schema.isInt(),
        Schema.isGreaterThanOrEqualTo(-365),
        Schema.isLessThanOrEqualTo(365),
      ),
    ).check(Schema.isMaxLength(10)),
  ),
  /** Days from issue to due, when a client has no term of its own. */
  paymentTermsDays: Schema.optional(
    NumericInput.check(
      Schema.isInt(),
      Schema.isGreaterThanOrEqualTo(0),
      Schema.isLessThanOrEqualTo(365),
    ),
  ),
  /** Percent of the overdue total, charged as a line on a new invoice. */
  lateFeePercent: Schema.optional(
    NumericInput.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(100)),
  ),
});
export type UpdateInvoiceSettingsBody = Wire<typeof UpdateInvoiceSettingsBody>;

export const UpdateInvoiceBody = CreateInvoiceBody.mapFields(Struct.map(Schema.optional));
export type UpdateInvoiceBody = Wire<typeof UpdateInvoiceBody>;

export const SendInvoiceEmailBody = Schema.Struct({
  /** Overrides the client's stored address for this one send. */
  to: Schema.optional(Email),
  subject: Schema.optional(Schema.String.check(Schema.isMaxLength(500))),
  message: Schema.optional(Schema.String.check(Schema.isMaxLength(5000))),
});
export type SendInvoiceEmailBody = Wire<typeof SendInvoiceEmailBody>;
