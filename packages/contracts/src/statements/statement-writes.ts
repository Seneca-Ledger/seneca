import * as Schema from 'effect/Schema';
import { DecimalString, Timestamp, type Wire } from '../common/wire';
import { StatementStage, StatementStatus } from './statement-list';

/**
 * A money column as a write answers it: the stored decimal string, or the
 * number the write just assigned.
 */
const WrittenAmount = Schema.Union([DecimalString, Schema.Number]);

/**
 * A statement as its writes answer it: the stored row without its
 * transactions. Money and dates come back as stored or as the write assigned
 * them, so they are looser than in `StatementDetail`; the page reads it back.
 */
export const StatementWritten = Schema.Struct({
  id: Schema.String,
  fileName: Schema.String,
  fileType: Schema.String,
  bankName: Schema.String,
  status: StatementStatus,
  stage: StatementStage,
  totalTransactions: Schema.Number,
  totalDebit: WrittenAmount,
  totalCredit: WrittenAmount,
  balanceStart: Schema.optional(Schema.NullOr(WrittenAmount)),
  balanceEnd: Schema.optional(Schema.NullOr(WrittenAmount)),
  /** `YYYY-MM-DD` as stored, an ISO timestamp where the write assigned a date. */
  statementDateFrom: Schema.optional(Schema.NullOr(Schema.String)),
  statementDateTo: Schema.optional(Schema.NullOr(Schema.String)),
  currency: Schema.String,
  /** Absent on a row just inserted, where the column was never assigned. */
  errorMessage: Schema.optional(Schema.NullOr(Schema.String)),
  categoryId: Schema.optional(Schema.NullOr(Schema.String)),
  processedAt: Schema.optional(Schema.NullOr(Timestamp)),
  deletedAt: Schema.optional(Schema.NullOr(Timestamp)),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type StatementWritten = Wire<typeof StatementWritten>;

const replay = {
  /** The `Idempotency-Key` header the upload carried. */
  idempotencyKey: Schema.optional(Schema.String),
  /** True when the key had been seen: this is the first upload's answer again. */
  cached: Schema.Boolean,
};

/** `POST /statements/upload`: the statements made, one per file. */
export const StatementUploadResult = Schema.Struct({
  data: Schema.Array(StatementWritten),
  ...replay,
});
export type StatementUploadResult = Wire<typeof StatementUploadResult>;

/** `POST /statements` (legacy, field `file`): a single file answers its statement unwrapped. */
export const StatementLegacyUploadResult = Schema.Union([
  StatementUploadResult,
  Schema.Struct({ ...StatementWritten.fields, ...replay }),
]);
export type StatementLegacyUploadResult = Wire<typeof StatementLegacyUploadResult>;

/** `POST /statements/manual-expense`: the one-row statement it made. */
export const ManualExpenseCreated = Schema.Struct({
  ...StatementWritten.fields,
  /** Set when the `Idempotency-Key` had been seen: the first answer again. */
  cached: Schema.optional(Schema.Boolean),
});
export type ManualExpenseCreated = Wire<typeof ManualExpenseCreated>;

/** `POST /statements/upload-receipt`: one statement per scanned file. */
export const ReceiptScanStatements = Schema.Struct({ data: Schema.Array(StatementWritten) });
export type ReceiptScanStatements = Wire<typeof ReceiptScanStatements>;

/** `POST /statements/:id/restore`: out of the trash, or the file brought back from storage. */
export const StatementRestored = Schema.Struct({
  status: Schema.Literal('restored'),
  source: Schema.Literals(['trash', 'disk', 'db', 'restored']),
});
export type StatementRestored = Wire<typeof StatementRestored>;

/** `POST /statements/:id/convert-dropped-sample`: the statement and the row it gained. */
export const DroppedSampleConverted = Schema.Struct({
  statement: StatementWritten,
  transaction: Schema.Struct({ id: Schema.String }),
});
export type DroppedSampleConverted = Wire<typeof DroppedSampleConverted>;

/** `POST /statements/stage`: the statements now in the stage, and why the others are not. */
export const StatementStageResult = Schema.Struct({
  updated: Schema.Array(Schema.String),
  skipped: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      code: Schema.Literals([
        'STATEMENT_NOT_FOUND',
        'STATEMENT_EDIT_FORBIDDEN',
        'INVALID_STAGE_TRANSITION',
        'UNCATEGORIZED_TRANSACTIONS',
      ]),
    }),
  ),
});
export type StatementStageResult = Wire<typeof StatementStageResult>;
