import * as Schema from 'effect/Schema';
import type { Wire } from '../common/wire';

/**
 * Teaching the parser a statement layout it could not read: the user marks
 * areas of the file and tags what each holds. Coordinates are the parser's
 * own: points from the page's top left.
 */

export const TeachTag = Schema.Literals([
  'date',
  'description',
  'counterparty',
  'debit',
  'credit',
  'amount',
  'balance',
  'header',
  'skip',
  'openingBalance',
  'closingBalance',
  'bankName',
]);
export type TeachTag = Wire<typeof TeachTag>;

const Coordinate = Schema.Number.check(
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isLessThanOrEqualTo(100_000),
);

export const TeachRegion = Schema.Struct({
  tag: TeachTag,
  page: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  x0: Coordinate,
  y0: Coordinate,
  x1: Coordinate,
  y1: Coordinate,
});
export type TeachRegion = Wire<typeof TeachRegion>;

/** `POST /statements/:id/teach` and `/teach/preview`. */
export const TeachLayoutBody = Schema.Struct({
  regions: Schema.Array(TeachRegion).check(Schema.isMaxLength(100)),
});
export type TeachLayoutBody = Wire<typeof TeachLayoutBody>;

/** `GET /statements/:id/layout-words`: every word the parser reads, where it sits. */
export const StatementLayoutWords = Schema.Struct({
  words: Schema.Array(
    Schema.Struct({
      text: Schema.String,
      page: Schema.Number,
      x: Schema.Number,
      y: Schema.Number,
      width: Schema.Number,
      height: Schema.Number,
    }),
  ),
});
export type StatementLayoutWords = Wire<typeof StatementLayoutWords>;

/** `POST /statements/:id/teach/preview`: how the file reads with the marked areas, nothing saved. */
export const TeachLayoutPreview = Schema.Struct({
  /** Tag groups still to mark before a reading is possible ("debit|credit|amount"). */
  missing: Schema.Array(Schema.String),
  transactions: Schema.Number,
  totalDebit: Schema.Number,
  totalCredit: Schema.Number,
  /** The reading's checks: a failed format check makes the statement wait for review. */
  checks: Schema.Array(
    Schema.Struct({
      code: Schema.String,
      passed: Schema.Boolean,
      row: Schema.optional(Schema.Number),
    }),
  ),
  /** Where each row read starts, to mark it on the page; `broken` where the balance chain breaks. */
  rows: Schema.Array(
    Schema.Struct({ page: Schema.Number, y: Schema.Number, broken: Schema.Boolean }),
  ),
});
export type TeachLayoutPreview = Wire<typeof TeachLayoutPreview>;
