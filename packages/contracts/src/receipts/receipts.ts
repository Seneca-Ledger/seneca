import * as Schema from 'effect/Schema';
import * as Struct from 'effect/Struct';
import { DecimalString, Timestamp, type Wire } from '../common/wire';

export const ReceiptTransactionMatch = Schema.Struct({
  transactionIds: Schema.Array(Schema.String),
  kind: Schema.Literals(['single', 'multi']),
  score: Schema.Number,
  computedAt: Schema.String,
});
export type ReceiptTransactionMatch = Wire<typeof ReceiptTransactionMatch>;

/** An OpenStreetMap place the user picked for a receipt. */
export const ReceiptPlace = Schema.Struct({
  name: Schema.String,
  category: Schema.NullOr(Schema.String),
  osmType: Schema.Literals(['node', 'way', 'relation']),
  osmId: Schema.String,
});
export type ReceiptPlace = Wire<typeof ReceiptPlace>;

export const ReceiptLocationSource = Schema.Literals([
  'merchant_address',
  'exif',
  'device',
  'manual',
  'fiscal_qr',
  'place',
]);
export type ReceiptLocationSource = Wire<typeof ReceiptLocationSource>;

/** jsonb written by the importers and the scan pipeline: every key may be missing. */
const ReceiptMetadata = Schema.Struct({
  attachments: Schema.optional(
    Schema.Array(
      Schema.Struct({
        id: Schema.optional(Schema.String),
        filename: Schema.optional(Schema.String),
        mimeType: Schema.optional(Schema.String),
        size: Schema.optional(Schema.Number),
      }),
    ),
  ),
  transactionMatch: Schema.optional(Schema.NullOr(ReceiptTransactionMatch)),
  place: Schema.optional(ReceiptPlace),
});

/** jsonb from the extraction: every key may be missing. */
const ReceiptParsedData = Schema.Struct({
  amount: Schema.optional(Schema.Number),
  currency: Schema.optional(Schema.String),
  vendor: Schema.optional(Schema.String),
  merchantAddress: Schema.optional(Schema.String),
  date: Schema.optional(Schema.String),
  tax: Schema.optional(Schema.Number),
  paymentMethod: Schema.optional(Schema.String),
  category: Schema.optional(Schema.String),
  categoryId: Schema.optional(Schema.String),
  lineItems: Schema.optional(
    Schema.Array(
      Schema.Struct({
        description: Schema.String,
        amount: Schema.Number,
        categoryId: Schema.optional(Schema.NullOr(Schema.String)),
      }),
    ),
  ),
  transactionType: Schema.optional(Schema.Literals(['unknown', 'income', 'expense', 'transfer'])),
  confidence: Schema.optional(Schema.Number),
  validationIssues: Schema.optional(Schema.Array(Schema.String)),
});

/** `GET /receipts/:id`, and a row of `GET /receipts`. */
export const ReceiptRecord = Schema.Struct({
  id: Schema.String,
  statementId: Schema.NullOr(Schema.String),
  transactionId: Schema.NullOr(Schema.String),
  source: Schema.Literals(['gmail', 'upload', 'telegram', 'scan', 'imap']),
  subject: Schema.String,
  sender: Schema.String,
  receivedAt: Timestamp,
  status: Schema.Literals([
    'new',
    'parsed',
    'needs_review',
    'draft',
    'reviewed',
    'approved',
    'rejected',
    'failed',
  ]),
  stage: Schema.Literals(['submit', 'approve', 'pay']),
  language: Schema.NullOr(Schema.String),
  metadata: Schema.NullOr(ReceiptMetadata),
  parsedData: Schema.NullOr(ReceiptParsedData),
  confidence: Schema.NullOr(DecimalString),
  taxAmount: Schema.NullOr(DecimalString),
  isDuplicate: Schema.Boolean,
  duplicateOfId: Schema.NullOr(Schema.String),
  locationLat: Schema.NullOr(Schema.Number),
  locationLng: Schema.NullOr(Schema.Number),
  locationSource: Schema.NullOr(ReceiptLocationSource),
  locationAccuracyM: Schema.NullOr(Schema.Number),
  locationUpdatedAt: Schema.NullOr(Timestamp),
  /** The category `parsedData.categoryId` names, looked up for display. */
  category: Schema.NullOr(Schema.Struct({ id: Schema.String, name: Schema.String })),
  createdAt: Timestamp,
});
export type ReceiptRecord = Wire<typeof ReceiptRecord>;

/**
 * A receipt as its updates answer (`PATCH /receipts/:id/location`, `DELETE` of
 * it): the stored row, without the category looked up for display.
 */
export const ReceiptRecordUpdate = ReceiptRecord.mapFields(Struct.omit(['category']));
export type ReceiptRecordUpdate = Wire<typeof ReceiptRecordUpdate>;

/** `GET /receipts`. */
export const ReceiptListPage = Schema.Struct({
  data: Schema.Array(ReceiptRecord),
  total: Schema.Number,
  page: Schema.Number,
  limit: Schema.Number,
});
export type ReceiptListPage = Wire<typeof ReceiptListPage>;

/** `GET /receipts/:id/transaction-matches`: bank rows the receipt could belong to. */
export const ReceiptTransactionMatches = Schema.Struct({
  suggestion: Schema.NullOr(ReceiptTransactionMatch),
  data: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      transactionDate: Schema.String,
      counterpartyName: Schema.String,
      amount: Schema.Number,
      currency: Schema.String,
      score: Schema.Number,
      daysApart: Schema.Number,
    }),
  ),
});
export type ReceiptTransactionMatches = Wire<typeof ReceiptTransactionMatches>;

/** `GET /receipts/:id/split-suggestion`: the receipt's lines grouped by category. */
export const ReceiptSplitSuggestion = Schema.Struct({
  transactionId: Schema.String,
  total: Schema.Number,
  currency: Schema.String,
  parts: Schema.Array(
    Schema.Struct({
      categoryId: Schema.NullOr(Schema.String),
      categoryName: Schema.NullOr(Schema.String),
      amount: Schema.Number,
      items: Schema.Array(Schema.String),
    }),
  ),
  splittable: Schema.Boolean,
});
export type ReceiptSplitSuggestion = Wire<typeof ReceiptSplitSuggestion>;

/** `GET /maps/styles`: the map styles the tile proxy serves. */
export const MapStyles = Schema.Struct({
  styles: Schema.Array(Schema.Struct({ id: Schema.String, name: Schema.String })),
  defaultStyleId: Schema.NullOr(Schema.String),
});
export type MapStyles = Wire<typeof MapStyles>;
