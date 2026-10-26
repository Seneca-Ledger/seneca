import * as Schema from 'effect/Schema';
import type { Wire } from '../common/wire';

const FilingFrequency = Schema.Literals(['monthly', 'quarterly', 'annual']);
const VatStatusLiteral = Schema.Literals(['registered', 'small_business', 'not_registered']);
const TransactionKind = Schema.Literals(['income', 'expense']);

/** `GET|PUT /tax/settings/vat-filing`: how often the workspace files VAT returns. */
export const VatFilingSettings = Schema.Struct({
  /** Null: the jurisdiction's usual frequency applies. */
  frequency: Schema.NullOr(FilingFrequency),
  isDefault: Schema.Boolean,
  extension: Schema.Boolean,
  /** What the jurisdiction calls the extension (Dauerfristverlängerung). */
  extensionName: Schema.NullOr(Schema.String),
  deadlinesKnown: Schema.Boolean,
  knownFrequencies: Schema.Array(FilingFrequency),
});
export type VatFilingSettings = Wire<typeof VatFilingSettings>;

/** `GET|PUT /tax/settings/reserve`: the workspace's own rule for money held for tax. */
export const TaxReserveSettings = Schema.Struct({
  percent: Schema.NullOr(Schema.Number),
  paymentsCategoryId: Schema.NullOr(Schema.String),
});
export type TaxReserveSettings = Wire<typeof TaxReserveSettings>;

/** `GET /tax/settings/reserve/amount`: how much of the money held is owed as tax. */
export const TaxReserve = Schema.Struct({
  currency: Schema.String,
  year: Schema.Number,
  asOf: Schema.String,
  vat: Schema.NullOr(
    Schema.Struct({ net: Schema.Number, outputTax: Schema.Number, inputTax: Schema.Number }),
  ),
  incomeTax: Schema.NullOr(
    Schema.Struct({ percent: Schema.Number, earnings: Schema.Number, amount: Schema.Number }),
  ),
  payments: Schema.Struct({
    categoryId: Schema.NullOr(Schema.String),
    amount: Schema.Number,
    count: Schema.Number,
  }),
  total: Schema.Number,
  /** Currencies of rows left out for want of an exchange rate on their day. */
  missingRateCurrencies: Schema.Array(Schema.String),
});
export type TaxReserve = Wire<typeof TaxReserve>;

/** `PUT /tax/settings/vat-status`: the status, and how many rows were taxed again. */
export const VatStatusChange = Schema.Struct({
  vatStatus: VatStatusLiteral,
  reassessed: Schema.Number,
});
export type VatStatusChange = Wire<typeof VatStatusChange>;

/** `POST /tax/settings/reassess`. */
export const TaxReassessment = Schema.Struct({ reassessed: Schema.Number });
export type TaxReassessment = Wire<typeof TaxReassessment>;

const OfficialRateDifference = Schema.Struct({
  key: Schema.String,
  kind: Schema.Literals(['standard_changed', 'reduced_missing', 'reduced_unlisted']),
  official: Schema.NullOr(Schema.Number),
  ours: Schema.NullOr(Schema.Number),
  /** When the official rate applies from, when the source says. */
  from: Schema.NullOr(Schema.String),
  categories: Schema.Array(Schema.String),
  canApply: Schema.Boolean,
});

/**
 * `GET /tax/settings/official-rates`, and the answer of refreshing, applying
 * and dismissing: the workspace's rates against the member state's (TEDB).
 */
export const OfficialRatesCheck = Schema.Struct({
  supported: Schema.Boolean,
  country: Schema.NullOr(Schema.String),
  fetchedAt: Schema.NullOr(Schema.String),
  sourceUrl: Schema.String,
  differences: Schema.Array(OfficialRateDifference),
  dismissed: Schema.Array(OfficialRateDifference),
});
export type OfficialRatesCheck = Wire<typeof OfficialRatesCheck>;

/** One row of `GET /tax/deadlines` (and of `PUT /tax/deadlines/filed-elsewhere`). */
export const TaxDeadline = Schema.Struct({
  kind: Schema.Literals(['vat_return', 'income_tax']),
  periodStart: Schema.String,
  periodEnd: Schema.String,
  dueDate: Schema.String,
  daysLeft: Schema.Number,
  done: Schema.Boolean,
  filedElsewhere: Schema.Boolean,
  returnName: Schema.String,
  /** Where the due date comes from: the law itself, or a published calendar. */
  basis: Schema.Literals(['statute', 'published']),
  checkedAt: Schema.String,
});
export type TaxDeadline = Wire<typeof TaxDeadline>;

export const TaxDeadlineList = Schema.Array(TaxDeadline);
export type TaxDeadlineList = Wire<typeof TaxDeadlineList>;

/** `GET /tax/year-report`: the year's tax-relevant rows by category. */
export const TaxYearReport = Schema.Struct({
  year: Schema.Number,
  currency: Schema.String,
  categories: Schema.Array(
    Schema.Struct({
      categoryId: Schema.NullOr(Schema.String),
      name: Schema.String,
      type: TransactionKind,
      count: Schema.Number,
      total: Schema.Number,
      documentCount: Schema.Number,
    }),
  ),
  rows: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      date: Schema.String,
      counterparty: Schema.String,
      categoryId: Schema.NullOr(Schema.String),
      categoryName: Schema.NullOr(Schema.String),
      type: TransactionKind,
      amount: Schema.Number,
      currency: Schema.String,
      converted: Schema.NullOr(Schema.Number),
      documentCount: Schema.Number,
      /** Marked tax-relevant on the row itself rather than through its category. */
      markedOnRow: Schema.Boolean,
    }),
  ),
  total: Schema.Struct({ income: Schema.Number, expense: Schema.Number }),
  missingRateCurrencies: Schema.Array(Schema.String),
});
export type TaxYearReport = Wire<typeof TaxYearReport>;

/** `GET /tax/returns/ustva`: the German VAT advance return of a period. */
export const UstvaResult = Schema.Struct({
  unsupported: Schema.NullOr(
    Schema.Literals(['not_germany', 'not_registered', 'form_year_unknown', 'period_spans_years']),
  ),
  form: Schema.NullOr(
    Schema.Struct({
      form: Schema.Literal('USt 1 A'),
      year: Schema.Number,
      sourceUrl: Schema.String,
      checkedAt: Schema.String,
      fields: Schema.Array(
        Schema.Struct({
          /** Kennzahl, the box number on the form. */
          kz: Schema.String,
          line: Schema.Number,
          label: Schema.String,
          kind: Schema.Literals(['base', 'tax']),
          amount: Schema.Number,
          transactionIds: Schema.Array(Schema.String),
        }),
      ),
      kz83: Schema.Number,
      open: Schema.Array(
        Schema.Struct({
          reason: Schema.Literals(['zero_rated', 'supply_type_unknown']),
          direction: TransactionKind,
          lines: Schema.Array(Schema.Number),
          net: Schema.Number,
          tax: Schema.Number,
          payeeId: Schema.NullOr(Schema.String),
          payeeName: Schema.NullOr(Schema.String),
          transactionIds: Schema.Array(Schema.String),
        }),
      ),
    }),
  ),
  missingRates: Schema.Array(
    Schema.Struct({ transactionId: Schema.String, date: Schema.String, currency: Schema.String }),
  ),
  sondervorauszahlungDue: Schema.Boolean,
});
export type UstvaResult = Wire<typeof UstvaResult>;

/** `GET|PUT /tax/datev/settings`. */
export const DatevSettings = Schema.Struct({
  /** False outside Germany: the export is a German format. */
  available: Schema.Boolean,
  chart: Schema.Literals(['03', '04']),
  consultantNumber: Schema.NullOr(Schema.Number),
  clientNumber: Schema.NullOr(Schema.Number),
  bankAccount: Schema.String,
  accounts: Schema.Record(Schema.String, Schema.String),
  bankAccounts: Schema.Record(Schema.String, Schema.String),
});
export type DatevSettings = Wire<typeof DatevSettings>;

/** `GET /tax/datev/mapping`: categories and bank accounts against DATEV accounts. */
export const DatevMapping = Schema.Struct({
  categories: Schema.Array(
    Schema.Struct({
      categoryId: Schema.String,
      name: Schema.String,
      type: TransactionKind,
      transactionCount: Schema.Number,
      account: Schema.NullOr(Schema.String),
      suggestion: Schema.NullOr(
        Schema.Struct({
          /** A key of the chart's reference list; shown by `name`. */
          concept: Schema.String,
          account: Schema.String,
          name: Schema.String,
        }),
      ),
    }),
  ),
  bankAccounts: Schema.Array(
    Schema.Struct({
      accountNumber: Schema.String,
      transactionCount: Schema.Number,
      account: Schema.NullOr(Schema.String),
    }),
  ),
});
export type DatevMapping = Wire<typeof DatevMapping>;

/** `GET /tax/datev/preview`: what an export of the period would contain. */
export const DatevPreview = Schema.Struct({
  bookings: Schema.Number,
  skipped: Schema.Struct({
    uncategorized: Schema.Number,
    unmapped: Schema.Array(
      Schema.Struct({ categoryId: Schema.String, name: Schema.String, count: Schema.Number }),
    ),
    foreignCurrency: Schema.Number,
  }),
  converted: Schema.Number,
  issues: Schema.Array(
    Schema.Union([
      Schema.Struct({
        kind: Schema.Literal('automatic_rate_mismatch'),
        transactionId: Schema.String,
        account: Schema.String,
        accountRate: Schema.Number,
        rate: Schema.Number,
      }),
      Schema.Struct({
        kind: Schema.Literal('unsupported_rate'),
        transactionId: Schema.String,
        rate: Schema.Number,
      }),
    ]),
  ),
  missingSettings: Schema.Array(Schema.Literals(['consultantNumber', 'clientNumber'])),
});
export type DatevPreview = Wire<typeof DatevPreview>;
