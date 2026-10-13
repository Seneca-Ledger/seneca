import * as Schema from 'effect/Schema';
import * as Struct from 'effect/Struct';
import {
  IsoDateString,
  isAtMostTwoDecimals,
  NumericInput,
  optionalNullable,
} from '../common/requests';
import type { Wire } from '../common/wire';

export const CreateTaxRateBody = Schema.Struct({
  name: Schema.String.check(Schema.isMinLength(1)),
  rate: NumericInput.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(100)),
  isDefault: optionalNullable(Schema.Boolean),
  isEnabled: optionalNullable(Schema.Boolean),
  /**
   * The buyer, not the seller, accounts for the tax: an intra-EU B2B supply.
   * The rate still sets the notional figure the return reports on both sides.
   */
  isReverseCharge: optionalNullable(Schema.Boolean),
});
export type CreateTaxRateBody = Wire<typeof CreateTaxRateBody>;

export const UpdateTaxRateBody = Schema.Struct({
  name: optionalNullable(Schema.String.check(Schema.isMinLength(1))),
  rate: optionalNullable(
    NumericInput.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(100)),
  ),
  isDefault: optionalNullable(Schema.Boolean),
  isEnabled: optionalNullable(Schema.Boolean),
  /**
   * The buyer, not the seller, accounts for the tax: an intra-EU B2B supply.
   * The rate still sets the notional figure the return reports on both sides.
   */
  isReverseCharge: optionalNullable(Schema.Boolean),
});
export type UpdateTaxRateBody = Wire<typeof UpdateTaxRateBody>;

export const TaxReturnPeriodBody = Schema.Struct({
  periodStart: IsoDateString,
  periodEnd: IsoDateString,
}).check(
  Schema.makeFilter(period =>
    Date.parse(period.periodEnd) >= Date.parse(period.periodStart)
      ? undefined
      : 'periodEnd must not be before periodStart',
  ),
);
export type TaxReturnPeriodBody = Wire<typeof TaxReturnPeriodBody>;

export const CreateTaxRuleBody = Schema.Struct({
  /** Omit for a catch-all rule covering its whole direction. */
  categoryId: optionalNullable(Schema.String.check(Schema.isUUID())),
  /** Stable rate code, e.g. 'KZ_STANDARD'. Resolved per transaction date. */
  taxRateCode: Schema.String.check(Schema.isBetweenLength(1, 40)),
  priority: optionalNullable(Schema.Int),
  direction: optionalNullable(Schema.Literals(['expense', 'income', 'both'])),
  isEnabled: optionalNullable(Schema.Boolean),
});
export type CreateTaxRuleBody = Wire<typeof CreateTaxRuleBody>;

export const UpdateTaxRuleBody = CreateTaxRuleBody.mapFields(Struct.map(optionalNullable));
export type UpdateTaxRuleBody = Wire<typeof UpdateTaxRuleBody>;

export const SetJurisdictionBody = Schema.Struct({
  /** ISO-3166-1 alpha-2 country code, e.g. 'KZ'. */
  code: Schema.String.check(Schema.isBetweenLength(2, 2)),
  /**
   * Day the new rate set takes over, defaulting to today. Rates of a previous
   * jurisdiction are closed off the day before, so history stays resolvable.
   */
  effectiveFrom: optionalNullable(IsoDateString),
});
export type SetJurisdictionBody = Wire<typeof SetJurisdictionBody>;

/** `PUT /tax/settings/vat-status`. */
export const SetVatStatusBody = Schema.Struct({
  status: Schema.Literals(['registered', 'small_business', 'not_registered']),
});
export type SetVatStatusBody = Wire<typeof SetVatStatusBody>;

/** `POST /tax/settings/reassess`. */
export const ReassessTaxBody = Schema.Struct({
  /** Only rows dated on or after this day; all unfiled rows when omitted. */
  from: optionalNullable(IsoDateString),
});
export type ReassessTaxBody = Wire<typeof ReassessTaxBody>;

/** `PUT /tax/settings/reserve`. */
export const SetTaxReserveBody = Schema.Struct({
  /** Share of income to set aside for income tax, 0–100; null switches it off. */
  percent: Schema.NullOr(
    Schema.Finite.check(
      isAtMostTwoDecimals,
      Schema.isGreaterThanOrEqualTo(0),
      Schema.isLessThanOrEqualTo(100),
    ),
  ),
  /** Expense category tax payments are booked to; null means none. */
  paymentsCategoryId: Schema.NullOr(Schema.String.check(Schema.isUUID())),
});
export type SetTaxReserveBody = Wire<typeof SetTaxReserveBody>;

/** `PUT /tax/settings/vat-filing`. */
export const SetVatFilingBody = Schema.Struct({
  /** Null goes back to the jurisdiction's usual frequency. */
  frequency: Schema.NullOr(Schema.Literals(['monthly', 'quarterly', 'annual'])),
  extension: Schema.Boolean,
});
export type SetVatFilingBody = Wire<typeof SetVatFilingBody>;

/** A difference's key, as the official-rates check returned it. */
const OfficialRateKey = Schema.String.check(
  Schema.isPattern(/^(standard_changed|reduced_missing|reduced_unlisted):[0-9.]+(:[0-9-]*)?$/),
);

/** `POST /tax/settings/official-rates/apply`. */
export const ApplyOfficialRateBody = Schema.Struct({ key: OfficialRateKey });
export type ApplyOfficialRateBody = Wire<typeof ApplyOfficialRateBody>;

/** `PUT /tax/settings/official-rates/dismissed`. */
export const DismissOfficialRateBody = Schema.Struct({
  key: OfficialRateKey,
  dismissed: Schema.Boolean,
});
export type DismissOfficialRateBody = Wire<typeof DismissOfficialRateBody>;

/** `PUT /tax/deadlines/filed-elsewhere`: a return filed outside Lumio, or not after all. */
export const FiledElsewhereBody = Schema.Struct({
  kind: Schema.Literals(['vat_return', 'income_tax']),
  periodEnd: IsoDateString,
  filed: Schema.Boolean,
});
export type FiledElsewhereBody = Wire<typeof FiledElsewhereBody>;
