import * as Schema from 'effect/Schema';
import { NumericInput, optionalNullable } from '../common/requests';
import type { Wire } from '../common/wire';

export const UpdateIncomeTaxProfileBody = Schema.Struct({
  taxYear: Schema.Int.check(Schema.isGreaterThanOrEqualTo(2000), Schema.isLessThanOrEqualTo(2100)),
  taxpayerType: Schema.Literals(['self_employed', 'employee', 'company']),
  details: optionalNullable(Schema.Record(Schema.String, Schema.Unknown)),
});
export type UpdateIncomeTaxProfileBody = Wire<typeof UpdateIncomeTaxProfileBody>;

export const IncomeTaxMappingEntryInput = Schema.Struct({
  categoryId: Schema.String.check(Schema.isUUID()),
  /** NULL withdraws the mapping. */
  lineKey: Schema.NullOr(Schema.String.check(Schema.isMaxLength(64))),
});
export type IncomeTaxMappingEntryInput = Wire<typeof IncomeTaxMappingEntryInput>;

export const SaveIncomeTaxMappingsBody = Schema.Struct({
  taxYear: Schema.Int.check(Schema.isGreaterThanOrEqualTo(2000), Schema.isLessThanOrEqualTo(2100)),
  entries: Schema.Array(IncomeTaxMappingEntryInput).check(Schema.isMaxLength(500)),
});
export type SaveIncomeTaxMappingsBody = Wire<typeof SaveIncomeTaxMappingsBody>;

/**
 * A tax year in a path or query. Only "a number" here: the range ends next
 * year, so `parseTaxYear` checks it and answers INCOME_TAX_YEAR_INVALID.
 */
const TaxYearInput = NumericInput;

export const IncomeTaxYearParams = Schema.Struct({ taxYear: TaxYearInput });
export type IncomeTaxYearParams = Wire<typeof IncomeTaxYearParams>;

/** `GET /income-tax/profile`, `GET /income-tax/mappings`. */
export const IncomeTaxYearQuery = Schema.Struct({ taxYear: TaxYearInput });
export type IncomeTaxYearQuery = Wire<typeof IncomeTaxYearQuery>;

/** `GET /income-tax/returns/:taxYear/export`. */
export const IncomeTaxExportQuery = Schema.Struct({
  format: Schema.Literals(['pdf', 'xlsx', 'csv']),
});
export type IncomeTaxExportQuery = Wire<typeof IncomeTaxExportQuery>;
