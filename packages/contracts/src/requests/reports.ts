import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as Struct from 'effect/Struct';
import { Email, IsoDateString, NumericInput, optionalNullable } from '../common/requests';
import type { Wire } from '../common/wire';

export const CustomTablesBaseQueryInput = Schema.Struct({
  days: optionalNullable(
    NumericInput.check(
      Schema.isInt(),
      Schema.isGreaterThanOrEqualTo(1),
      Schema.isLessThanOrEqualTo(3650),
    ),
  ),
  tableIds: optionalNullable(
    Schema.Array(Schema.String.check(Schema.isUUID())).check(Schema.isUnique()),
  ),
});
export type CustomTablesBaseQueryInput = Wire<typeof CustomTablesBaseQueryInput>;

export const CustomTablesSummaryBody = CustomTablesBaseQueryInput.mapFields(Struct.assign({}));
export type CustomTablesSummaryBody = Wire<typeof CustomTablesSummaryBody>;

export const CustomTablesReportBody = CustomTablesBaseQueryInput.mapFields(
  Struct.assign({
    flowType: optionalNullable(Schema.Literals(['all', 'expense', 'income'])),
    sortBy: optionalNullable(Schema.Literals(['amount', 'average', 'operations'])),
    search: optionalNullable(Schema.String),
    limit: optionalNullable(
      NumericInput.check(
        Schema.isInt(),
        Schema.isGreaterThanOrEqualTo(1),
        Schema.isLessThanOrEqualTo(500),
      ),
    ),
  }),
);
export type CustomTablesReportBody = Wire<typeof CustomTablesReportBody>;

export const CustomTablesReportDrillDownBody = CustomTablesBaseQueryInput.mapFields(
  Struct.assign({
    counterparty: Schema.String,
    flowType: optionalNullable(Schema.Literals(['all', 'expense', 'income'])),
    limit: optionalNullable(
      NumericInput.check(
        Schema.isInt(),
        Schema.isGreaterThanOrEqualTo(1),
        Schema.isLessThanOrEqualTo(200),
      ),
    ),
  }),
);
export type CustomTablesReportDrillDownBody = Wire<typeof CustomTablesReportDrillDownBody>;

export const CustomReportBody = Schema.Struct({
  dateFrom: IsoDateString,
  dateTo: IsoDateString,
  groupBy: optionalNullable(
    Schema.Literals(['category', 'counterparty', 'branch', 'wallet', 'day', 'month']),
  ),
  categoryId: optionalNullable(Schema.String),
  branchId: optionalNullable(Schema.String),
  walletId: optionalNullable(Schema.String),
  format: Schema.Literals(['json', 'excel', 'csv']).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed('json')),
  ),
});
export type CustomReportBody = Wire<typeof CustomReportBody>;

export const ExportReportBody = Schema.Struct({
  dateFrom: optionalNullable(IsoDateString),
  dateTo: optionalNullable(IsoDateString),
  format: Schema.Literals(['excel', 'csv']).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed('excel')),
  ),
});
export type ExportReportBody = Wire<typeof ExportReportBody>;

export const GenerateReportBody = Schema.Struct({
  templateId: Schema.String,
  dateFrom: IsoDateString,
  dateTo: IsoDateString,
  format: Schema.Literals(['pdf', 'excel', 'csv']),
  /** Restrict to these wallets; empty or omitted means all of them. */
  walletIds: optionalNullable(Schema.Array(Schema.String.check(Schema.isUUID()))),
  /** Restrict to these categories; empty or omitted means all of them. */
  categoryIds: optionalNullable(Schema.Array(Schema.String.check(Schema.isUUID()))),
  /** Only Cash Flow uses this; defaults to daily buckets. */
  groupBy: optionalNullable(Schema.Literals(['day', 'week', 'month'])),
  /** Only Balance Sheet uses this, to localize account names. */
  locale: optionalNullable(Schema.Literals(['ru', 'en', 'kk'])),
});
export type GenerateReportBody = Wire<typeof GenerateReportBody>;

export const WorkspaceExportBody = Schema.Struct({
  format: Schema.Literals(['excel', 'pdf', 'csv', 'docx']).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed('excel')),
  ),
});
export type WorkspaceExportBody = Wire<typeof WorkspaceExportBody>;

export const CreateReportScheduleBody = Schema.Struct({
  templateId: Schema.String,
  format: Schema.Literals(['pdf', 'excel', 'csv']),
  cadence: Schema.Literals(['daily', 'weekly', 'monthly']),
  /** Capped so a schedule cannot be turned into a bulk mailer. */
  recipients: Schema.Array(Email).check(Schema.isMinLength(1), Schema.isMaxLength(20)),
  walletIds: optionalNullable(Schema.Array(Schema.String.check(Schema.isUUID()))),
  categoryIds: optionalNullable(Schema.Array(Schema.String.check(Schema.isUUID()))),
  groupBy: optionalNullable(Schema.Literals(['day', 'week', 'month'])),
  locale: optionalNullable(Schema.Literals(['ru', 'en', 'kk'])),
});
export type CreateReportScheduleBody = Wire<typeof CreateReportScheduleBody>;

export const UpdateReportScheduleActiveBody = Schema.Struct({
  isActive: Schema.Boolean,
});
export type UpdateReportScheduleActiveBody = Wire<typeof UpdateReportScheduleActiveBody>;
