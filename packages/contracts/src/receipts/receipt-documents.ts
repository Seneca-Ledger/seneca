import * as Schema from 'effect/Schema';
import type { Wire } from '../common/wire';
import { ReceiptRecord } from './receipts';

/** `GET /receipts/documents`: receipts of every source, newest first, for the Documents list. */
export const ReceiptDocumentsPage = Schema.Struct({
  receipts: Schema.Array(ReceiptRecord),
  total: Schema.Number,
  limit: Schema.Number,
  offset: Schema.Number,
});
export type ReceiptDocumentsPage = Wire<typeof ReceiptDocumentsPage>;

/** `POST /receipts/stage`: the receipts now in the stage, and why the others are not. */
export const ReceiptStageResult = Schema.Struct({
  updated: Schema.Array(Schema.String),
  skipped: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      code: Schema.Literals([
        'RECEIPT_NOT_FOUND',
        'RECEIPT_EDIT_FORBIDDEN',
        'INVALID_STAGE_TRANSITION',
        'MISSING_RECEIPT_DATA',
      ]),
    }),
  ),
});
export type ReceiptStageResult = Wire<typeof ReceiptStageResult>;

/** `POST /receipts/bulk-approve`: how many were booked, and why the others were not. */
export const ReceiptBulkApproveResult = Schema.Struct({
  approved: Schema.Number,
  failed: Schema.Number,
  errors: Schema.Array(Schema.Struct({ receiptId: Schema.String, error: Schema.String })),
});
export type ReceiptBulkApproveResult = Wire<typeof ReceiptBulkApproveResult>;
