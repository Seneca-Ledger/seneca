import * as Schema from 'effect/Schema';
import { DateOnly, DecimalString, Timestamp, type Wire } from '../common/wire';

export const TaxRateKind = Schema.Literals(['standard', 'reduced', 'zero', 'exempt']);
export type TaxRateKind = Wire<typeof TaxRateKind>;

/** One row of `GET /tax-rates`: the workspace's own rates. */
export const TaxRateItem = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  /** Percent, as a decimal string. */
  rate: DecimalString,
  isDefault: Schema.Boolean,
  isEnabled: Schema.Boolean,
  jurisdictionId: Schema.NullOr(Schema.String),
  code: Schema.NullOr(Schema.String),
  kind: TaxRateKind,
  validFrom: DateOnly,
  validTo: Schema.NullOr(DateOnly),
  isInclusive: Schema.Boolean,
  isReverseCharge: Schema.Boolean,
});
export type TaxRateItem = Wire<typeof TaxRateItem>;

export const TaxRateList = Schema.Array(TaxRateItem);
export type TaxRateList = Wire<typeof TaxRateList>;

/** A country's consumption-tax regime, from the reference data. */
export const TaxJurisdictionItem = Schema.Struct({
  id: Schema.String,
  code: Schema.String,
  name: Schema.String,
  taxName: Schema.String,
  currency: Schema.String,
  scheme: Schema.Literals(['vat', 'gst', 'sales_tax', 'none']),
  isEu: Schema.Boolean,
  filingPeriod: Schema.Literals(['monthly', 'quarterly', 'annual']),
  registrationThreshold: Schema.NullOr(DecimalString),
  thresholdPeriod: Schema.NullOr(Schema.Literals(['calendar_year', 'rolling_12m'])),
});
export type TaxJurisdictionItem = Wire<typeof TaxJurisdictionItem>;

/** `GET /tax/jurisdictions`. */
export const TaxJurisdictionList = Schema.Array(TaxJurisdictionItem);
export type TaxJurisdictionList = Wire<typeof TaxJurisdictionList>;

/** `GET /tax/jurisdictions/:code/rates`. */
export const JurisdictionRateList = Schema.Array(
  Schema.Struct({
    id: Schema.String,
    code: Schema.String,
    name: Schema.String,
    rate: DecimalString,
    kind: TaxRateKind,
    isDefault: Schema.Boolean,
    validFrom: DateOnly,
    validTo: Schema.NullOr(DateOnly),
  }),
);
export type JurisdictionRateList = Wire<typeof JurisdictionRateList>;

/** `GET /tax/settings`. */
export const WorkspaceTaxSettings = Schema.Struct({
  jurisdiction: Schema.NullOr(TaxJurisdictionItem),
});
export type WorkspaceTaxSettings = Wire<typeof WorkspaceTaxSettings>;

/** `GET /tax/settings/threshold`: null without a jurisdiction. */
export const TaxThresholdStatus = Schema.NullOr(
  Schema.Struct({
    threshold: Schema.NullOr(Schema.Number),
    turnover: Schema.Number,
    currency: Schema.String,
    percentUsed: Schema.Number,
    periodStart: Schema.String,
    periodEnd: Schema.String,
    window: Schema.String,
  }),
);
export type TaxThresholdStatus = Wire<typeof TaxThresholdStatus>;

/** One row of `GET /tax/rules`: which rate a category's rows get. */
export const TaxRuleItem = Schema.Struct({
  id: Schema.String,
  categoryId: Schema.NullOr(Schema.String),
  taxRateCode: Schema.String,
  priority: Schema.Number,
  direction: Schema.Literals(['expense', 'income', 'both']),
  isEnabled: Schema.Boolean,
});
export type TaxRuleItem = Wire<typeof TaxRuleItem>;

export const TaxRuleList = Schema.Array(TaxRuleItem);
export type TaxRuleList = Wire<typeof TaxRuleList>;

export const TaxReturnLine = Schema.Struct({
  transactionId: Schema.String,
  date: Schema.String,
  counterparty: Schema.String,
  direction: Schema.Literals(['output', 'input', 'reverse_charge']),
  currency: Schema.String,
  taxAmount: Schema.Number,
  netAmount: Schema.Number,
  exchangeRate: Schema.Number,
  taxAmountConverted: Schema.Number,
});
export type TaxReturnLine = Wire<typeof TaxReturnLine>;

/** `GET /tax/returns/preview`: the period computed live. */
export const TaxReturnPreview = Schema.Struct({
  outputTax: Schema.Number,
  inputTax: Schema.Number,
  netPayable: Schema.Number,
  currency: Schema.String,
  lines: Schema.Array(TaxReturnLine),
});
export type TaxReturnPreview = Wire<typeof TaxReturnPreview>;

/** `GET /tax/returns/period`: the saved return of a period, frozen once filed. */
export const TaxReturnRecord = Schema.Struct({
  id: Schema.String,
  jurisdictionId: Schema.String,
  periodStart: DateOnly,
  periodEnd: DateOnly,
  status: Schema.Literals(['draft', 'filed']),
  outputTax: DecimalString,
  inputTax: DecimalString,
  netPayable: DecimalString,
  currency: Schema.String,
  filedAt: Schema.NullOr(Timestamp),
  snapshot: Schema.NullOr(Schema.Array(TaxReturnLine)),
  createdAt: Timestamp,
});
export type TaxReturnRecord = Wire<typeof TaxReturnRecord>;
