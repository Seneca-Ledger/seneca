import * as Schema from 'effect/Schema';
import * as Struct from 'effect/Struct';
import { NumericInput, optionalNullable } from '../common/requests';
import type { Wire } from '../common/wire';

/**
 * Where the phone was when the receipt was photographed. Sent as multipart
 * fields next to the file, hence the Number coercion.
 */
export const CaptureLocationFieldsInput = Schema.Struct({
  latitude: optionalNullable(
    NumericInput.check(Schema.isGreaterThanOrEqualTo(-90), Schema.isLessThanOrEqualTo(90)),
  ),
  longitude: optionalNullable(
    NumericInput.check(Schema.isGreaterThanOrEqualTo(-180), Schema.isLessThanOrEqualTo(180)),
  ),
  accuracy: optionalNullable(
    NumericInput.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(100000)),
  ),
});
export type CaptureLocationFieldsInput = Wire<typeof CaptureLocationFieldsInput>;

export const UploadReceiptBody = CaptureLocationFieldsInput.mapFields(
  Struct.assign({
    language: optionalNullable(Schema.String),
  }),
);
export type UploadReceiptBody = Wire<typeof UploadReceiptBody>;

/** A GPS fix taken after the receipt was photographed without one. */
export const PlaceSuggestionsBody = Schema.Struct({
  statementId: Schema.String.check(Schema.isUUID()),
  latitude: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(-90), Schema.isLessThanOrEqualTo(90)),
  longitude: Schema.Finite.check(
    Schema.isGreaterThanOrEqualTo(-180),
    Schema.isLessThanOrEqualTo(180),
  ),
  accuracy: optionalNullable(
    Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(100000)),
  ),
});
export type PlaceSuggestionsBody = Wire<typeof PlaceSuggestionsBody>;

/** The OpenStreetMap place the user picked from the list of places nearby. */
export const ReceiptPlaceInput = Schema.Struct({
  name: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200)),
  category: optionalNullable(Schema.String.check(Schema.isMaxLength(64))),
  osmType: Schema.Literals(['node', 'way', 'relation']),
  osmId: Schema.String.check(Schema.isPattern(/^\d{1,20}$/)),
});
export type ReceiptPlaceInput = Wire<typeof ReceiptPlaceInput>;

export const UpdateReceiptLocationBody = Schema.Struct({
  latitude: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(-90), Schema.isLessThanOrEqualTo(90)),
  longitude: Schema.Finite.check(
    Schema.isGreaterThanOrEqualTo(-180),
    Schema.isLessThanOrEqualTo(180),
  ),
  place: optionalNullable(ReceiptPlaceInput),
});
export type UpdateReceiptLocationBody = Wire<typeof UpdateReceiptLocationBody>;

/**
 * The parsed fields the receipt forms edit. The rest of `parsedData` (where a
 * category came from, validation issues, the e-invoice summary, a line's
 * booked category) is the server's, so an unknown key is a 400, not a merge.
 */
export const ReceiptParsedDataInput = Schema.Struct({
  vendor: optionalNullable(Schema.String),
  amount: optionalNullable(Schema.Finite),
  currency: optionalNullable(Schema.String),
  date: optionalNullable(Schema.String),
  tax: optionalNullable(Schema.Finite),
  paymentMethod: optionalNullable(Schema.String),
  transactionType: optionalNullable(Schema.Literals(['income', 'expense', 'transfer', 'unknown'])),
  category: optionalNullable(Schema.String),
  categoryId: optionalNullable(Schema.String.check(Schema.isUUID())),
  lineItems: optionalNullable(
    Schema.Array(
      Schema.Struct({
        description: Schema.String,
        // A line whose amount the form could not read arrives as null (JSON has no NaN).
        amount: Schema.NullOr(Schema.Finite),
      }),
    ),
  ),
});
export type ReceiptParsedDataInput = Wire<typeof ReceiptParsedDataInput>;

export const UpdateReceiptBody = Schema.Struct({
  status: optionalNullable(
    Schema.Literals([
      'new',
      'parsed',
      'needs_review',
      'draft',
      'reviewed',
      'approved',
      'rejected',
      'failed',
    ]),
  ),
  parsedData: optionalNullable(ReceiptParsedDataInput),
});
export type UpdateReceiptBody = Wire<typeof UpdateReceiptBody>;

export const UpdateReceiptStageBody = Schema.Struct({
  receiptIds: Schema.Array(Schema.String.check(Schema.isUUID())).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(500),
  ),
  stage: Schema.Literals(['submit', 'approve', 'pay']),
});
export type UpdateReceiptStageBody = Wire<typeof UpdateReceiptStageBody>;

export const ApproveReceiptBody = Schema.Struct({
  /**
   * The bank row to attach the receipt to. Omitted: the stored suggestion is
   * used when there is one. `null`: book a new transaction regardless.
   */
  transactionId: optionalNullable(Schema.String.check(Schema.isUUID())),
});
export type ApproveReceiptBody = Wire<typeof ApproveReceiptBody>;

export const BulkApproveBody = Schema.Struct({
  receiptIds: Schema.Array(Schema.String.check(Schema.isUUID())),
  categoryId: optionalNullable(Schema.String.check(Schema.isUUID())),
});
export type BulkApproveBody = Wire<typeof BulkApproveBody>;

/** `POST /receipts/:id/split`: the preview as the user corrected it. */
export const ApplyReceiptSplitBody = Schema.Struct({
  /**
   * The receipt's lines with the category the user settled on: the same lines,
   * only the categories may differ. Without it the suggestion is applied as is.
   */
  items: optionalNullable(
    Schema.Array(
      Schema.Struct({
        description: Schema.String,
        amount: Schema.Finite,
        categoryId: optionalNullable(Schema.String.check(Schema.isUUID())),
      }),
    ),
  ),
});
export type ApplyReceiptSplitBody = Wire<typeof ApplyReceiptSplitBody>;

/** A rate picked by hand for the receipt's transaction; null hands it back to the rules. */
export const SetReceiptTaxBody = Schema.Struct({
  taxRateId: Schema.NullOr(Schema.String.check(Schema.isUUID())),
});
export type SetReceiptTaxBody = Wire<typeof SetReceiptTaxBody>;

export const SetReceiptTagsBody = Schema.Struct({
  /** The complete desired tag set for the receipt; an empty array clears it. */
  tagIds: Schema.Array(Schema.String.check(Schema.isUUID())).check(Schema.isMaxLength(50)),
});
export type SetReceiptTagsBody = Wire<typeof SetReceiptTagsBody>;
