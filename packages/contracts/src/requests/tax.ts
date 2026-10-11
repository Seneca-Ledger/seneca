import * as Schema from 'effect/Schema';
import * as Struct from 'effect/Struct';
import { IsoDateString, NumericInput } from '../common/requests';
import type { Wire } from '../common/wire';

export const CreateTaxRateBody = Schema.Struct({
  name: Schema.String.check(Schema.isMinLength(1)),
  rate: NumericInput.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(100)),
  isDefault: Schema.optional(Schema.Boolean),
  isEnabled: Schema.optional(Schema.Boolean),
});
export type CreateTaxRateBody = Wire<typeof CreateTaxRateBody>;

export const UpdateTaxRateBody = Schema.Struct({
  name: Schema.optional(Schema.String.check(Schema.isMinLength(1))),
  rate: Schema.optional(
    NumericInput.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(100)),
  ),
  isDefault: Schema.optional(Schema.Boolean),
  isEnabled: Schema.optional(Schema.Boolean),
});
export type UpdateTaxRateBody = Wire<typeof UpdateTaxRateBody>;

export const TaxReturnPeriodBody = Schema.Struct({
  periodStart: IsoDateString,
  periodEnd: IsoDateString,
});
export type TaxReturnPeriodBody = Wire<typeof TaxReturnPeriodBody>;

export const CreateTaxRuleBody = Schema.Struct({
  /** Omit for a catch-all rule covering its whole direction. */
  categoryId: Schema.optional(Schema.String.check(Schema.isUUID())),
  /** Stable rate code, e.g. 'KZ_STANDARD'. Resolved per transaction date. */
  taxRateCode: Schema.String.check(Schema.isBetweenLength(1, 40)),
  priority: Schema.optional(Schema.Int),
  direction: Schema.optional(Schema.Literals(['expense', 'income', 'both'])),
  isEnabled: Schema.optional(Schema.Boolean),
});
export type CreateTaxRuleBody = Wire<typeof CreateTaxRuleBody>;

export const UpdateTaxRuleBody = CreateTaxRuleBody.mapFields(Struct.map(Schema.optional));
export type UpdateTaxRuleBody = Wire<typeof UpdateTaxRuleBody>;

export const SetJurisdictionBody = Schema.Struct({
  /** ISO-3166-1 alpha-2 country code, e.g. 'KZ'. */
  code: Schema.String.check(Schema.isBetweenLength(2, 2)),
  /**
   * Day the new rate set takes over, defaulting to today. Rates of a previous
   * jurisdiction are closed off the day before, so history stays resolvable.
   */
  effectiveFrom: Schema.optional(IsoDateString),
});
export type SetJurisdictionBody = Wire<typeof SetJurisdictionBody>;
