import * as Schema from 'effect/Schema';
import * as Struct from 'effect/Struct';
import { DateOnly, DecimalString, Timestamp, type Wire } from '../common/wire';
import { TransactionListItem } from '../transactions/transaction-list';

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

/** A key the parser may have written; `null` where a writer had no value. */
const maybe = <S extends Schema.Top>(schema: S) => Schema.optional(Schema.NullOr(schema));

const Rest = [Schema.Record(Schema.String, Schema.Unknown)] as const;

const Strings = Schema.Array(Schema.String);

/** A parsed row the import left out, as the parser kept it. */
const DroppedSampleTransaction = Schema.StructWithRest(
  Schema.Struct({
    transactionDate: maybe(Schema.String),
    documentNumber: maybe(Schema.String),
    counterpartyName: maybe(Schema.String),
    counterpartyBin: maybe(Schema.String),
    counterpartyAccount: maybe(Schema.String),
    counterpartyBank: maybe(Schema.String),
    paymentPurpose: maybe(Schema.String),
    debit: maybe(Schema.Number),
    credit: maybe(Schema.Number),
    currency: maybe(Schema.String),
  }),
  Rest,
);

/**
 * The parser's notes on a statement. Free-form JSON (every writer adds its own
 * keys), so only the keys the app reads are typed; the rest passes through.
 */
export const StatementParsingDetails = Schema.StructWithRest(
  Schema.Struct({
    detectedBank: maybe(Schema.String),
    detectedFormat: maybe(Schema.String),
    detectedBy: maybe(Schema.String),
    detectedEvidence: maybe(Strings),
    otherBankMentions: maybe(Strings),
    parserUsed: maybe(Schema.String),
    totalLinesProcessed: maybe(Schema.Number),
    transactionsFound: maybe(Schema.Number),
    transactionsCreated: maybe(Schema.Number),
    errors: maybe(Strings),
    warnings: maybe(Strings),
    processingTime: maybe(Schema.Number),
    droppedSamples: maybe(
      Schema.Array(
        Schema.Union([
          Schema.String,
          Schema.Struct({ reason: Schema.String, transaction: maybe(DroppedSampleTransaction) }),
        ]),
      ),
    ),
    validation: maybe(
      Schema.Struct({
        passed: Schema.Boolean,
        warnings: maybe(Strings),
        balanceCheck: maybe(
          Schema.Struct({
            expectedEnd: maybe(Schema.Number),
            actualEnd: maybe(Schema.Number),
            difference: maybe(Schema.Number),
            tolerance: maybe(Schema.Number),
          }),
        ),
      }),
    ),
    balanceConfirmation: maybe(
      Schema.Struct({ confirmedBy: Schema.String, confirmedAt: Schema.String }),
    ),
    logEntries: maybe(
      Schema.Array(
        Schema.Struct({ timestamp: Schema.String, level: Schema.String, message: Schema.String }),
      ),
    ),
    importPreview: maybe(
      Schema.StructWithRest(
        Schema.Struct({
          source: maybe(Schema.String),
          merchant: maybe(Schema.String),
          description: maybe(Schema.String),
          attachments: maybe(Schema.Number),
          categoryId: maybe(Schema.String),
        }),
        Rest,
      ),
    ),
    metadataExtracted: maybe(
      Schema.StructWithRest(
        Schema.Struct({
          accountNumber: maybe(Schema.String),
          dateFrom: maybe(Schema.String),
          dateTo: maybe(Schema.String),
          balanceStart: maybe(Schema.Number),
          balanceEnd: maybe(Schema.Number),
          currency: maybe(Schema.String),
          rawHeader: maybe(Schema.String),
          normalizedHeader: maybe(Schema.String),
          headerDisplay: maybe(
            Schema.StructWithRest(
              Schema.Struct({
                title: maybe(Schema.String),
                subtitle: maybe(Schema.String),
                periodDisplay: maybe(Schema.String),
                accountDisplay: maybe(Schema.String),
                institutionDisplay: maybe(Schema.String),
                currencyDisplay: maybe(Schema.String),
              }),
              Rest,
            ),
          ),
        }),
        Rest,
      ),
    ),
  }),
  Rest,
);
export type StatementParsingDetails = Wire<typeof StatementParsingDetails>;

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
  parsingDetails: Schema.NullOr(StatementParsingDetails),
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

/** `GET /statements` as a page, envelope and all. */
export const StatementListPage = Schema.Struct({
  data: StatementList,
  /** Repeats `data` for older clients. */
  items: StatementList,
  total: Schema.Number,
  page: Schema.Number,
  limit: Schema.Number,
});
export type StatementListPage = Wire<typeof StatementListPage>;

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
  parsingDetails: Schema.NullOr(StatementParsingDetails),
  createdAt: Timestamp,
  /** Its rows as stored, without their category, branch or wallet. */
  transactions: Schema.optional(
    Schema.Array(TransactionListItem.mapFields(Struct.omit(['category', 'branch', 'wallet']))),
  ),
});
export type StatementDetail = Wire<typeof StatementDetail>;
