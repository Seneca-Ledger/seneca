import * as Schema from 'effect/Schema';
import { DateOnly, DecimalString, Timestamp, type Wire } from '../common/wire';

export const StatementStatus = Schema.Literals([
  'uploaded',
  'processing',
  'parsed',
  'validated',
  'completed',
  'needs_review',
  'error',
]);
export type StatementStatus = Wire<typeof StatementStatus>;

export const StatementStage = Schema.Literals(['submit', 'approve', 'pay']);
export type StatementStage = Wire<typeof StatementStage>;

/**
 * One row of `GET /statements` (inside the `{ data }` envelope). Only the
 * fields the app reads; the row carries more (and must keep `filePath`, a
 * server path, out of any contract).
 */
export const StatementListItem = Schema.Struct({
  id: Schema.String,
  fileName: Schema.String,
  fileType: Schema.String,
  bankName: Schema.String,
  status: StatementStatus,
  stage: StatementStage,
  errorMessage: Schema.NullOr(Schema.String),
  totalTransactions: Schema.Number,
  totalDebit: DecimalString,
  totalCredit: DecimalString,
  balanceStart: Schema.NullOr(DecimalString),
  balanceEnd: Schema.NullOr(DecimalString),
  currency: Schema.String,
  statementDateFrom: Schema.NullOr(DateOnly),
  statementDateTo: Schema.NullOr(DateOnly),
  createdAt: Timestamp,
  updatedAt: Timestamp,
  processedAt: Schema.NullOr(Timestamp),
  categoryId: Schema.NullOr(Schema.String),
  category: Schema.NullOr(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      color: Schema.NullOr(Schema.String),
      icon: Schema.NullOr(Schema.String),
    }),
  ),
  tags: Schema.Array(
    Schema.Struct({ id: Schema.String, name: Schema.String, color: Schema.NullOr(Schema.String) }),
  ),
  user: Schema.NullOr(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      email: Schema.String,
      avatarUrl: Schema.NullOr(Schema.String),
    }),
  ),
  /** Free-form parser output; read leniently by the views. */
  parsingDetails: Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown)),
  transactionSummary: Schema.Struct({
    description: Schema.NullOr(Schema.String),
    /** A raw MIN() over a decimal column: a string from Postgres, typed loosely in case a driver converts it. */
    exchangeRate: Schema.NullOr(Schema.Union([DecimalString, Schema.Number])),
    exchangeRateMixed: Schema.Boolean,
    cardLabel: Schema.NullOr(Schema.String),
  }),
});
export type StatementListItem = Wire<typeof StatementListItem>;

export const StatementList = Schema.Array(StatementListItem);
export type StatementList = Wire<typeof StatementList>;

/**
 * `GET /statements/:id`, as the statement editor reads it. The category is not
 * loaded here: the editor finds it in the category list by `categoryId`.
 */
export const StatementDetail = Schema.Struct({
  id: Schema.String,
  fileName: Schema.String,
  fileType: Schema.String,
  bankName: Schema.String,
  status: StatementStatus,
  stage: StatementStage,
  totalTransactions: Schema.Number,
  balanceStart: Schema.NullOr(DecimalString),
  balanceEnd: Schema.NullOr(DecimalString),
  currency: Schema.String,
  statementDateFrom: Schema.NullOr(DateOnly),
  statementDateTo: Schema.NullOr(DateOnly),
  categoryId: Schema.NullOr(Schema.String),
  /** Free-form parser output; read leniently by the editor. */
  parsingDetails: Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown)),
  createdAt: Timestamp,
});
export type StatementDetail = Wire<typeof StatementDetail>;
