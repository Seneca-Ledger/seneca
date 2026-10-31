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
      /** Its line starts with a date, as the parser reads one ("02 Sep", "01-02-2025"). */
      dated: Schema.Boolean,
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

/**
 * A taught layout as it leaves the instance when the user shares it with the
 * project: headings, column positions, balance labels, the bank's name.
 */
export const LayoutSubmission = Schema.Struct({
  version: Schema.Literal(1),
  bankName: Schema.String,
  institution: Schema.optional(Schema.String),
  headings: Schema.Array(Schema.Struct({ phrase: Schema.String, role: Schema.String })),
  columns: Schema.Array(
    Schema.Struct({ role: Schema.String, x0: Schema.Number, x1: Schema.Number }),
  ),
  balances: Schema.Struct({
    start: Schema.optional(Schema.String),
    end: Schema.optional(Schema.String),
  }),
  appVersion: Schema.optional(Schema.String),
  /** How the statement prints: date and amount shapes (digits as #), rows, pages, type. */
  print: Schema.optional(
    Schema.Struct({
      dateShape: Schema.optional(Schema.String),
      amounts: Schema.optional(
        Schema.Struct({
          decimal: Schema.String,
          thousands: Schema.String,
          negative: Schema.Literals(['minus', 'trailing-minus', 'parentheses', 'none']),
          marks: Schema.Array(Schema.String),
        }),
      ),
      descriptionLines: Schema.Number,
      pages: Schema.Number,
      headerOnEveryPage: Schema.Boolean,
      fontSize: Schema.optional(Schema.Number),
      rowGap: Schema.optional(Schema.Number),
      currency: Schema.optional(Schema.String),
    }),
  ),
  /** How the layout read the statement it was taught on: counts and check outcomes. */
  evidence: Schema.optional(
    Schema.Struct({
      rows: Schema.Number,
      balanceChain: Schema.Literals(['passed', 'failed', 'unchecked']),
      printedTotals: Schema.Literals(['passed', 'failed', 'unchecked']),
      statementsRead: Schema.Number,
    }),
  ),
});
export type LayoutSubmission = Wire<typeof LayoutSubmission>;

/** `GET /statements/:id/teach/share`: what sharing the statement's layout would send, and how. */
export const TeachShareInfo = Schema.Struct({
  /** False when the instance turned sharing off: the offer is not shown. */
  enabled: Schema.Boolean,
  /** False when no receiving service is set: the user sends it by e-mail. */
  direct: Schema.Boolean,
  /** Where an e-mail goes, and whom to ask to delete what was sent. */
  email: Schema.String,
  submission: LayoutSubmission,
});
export type TeachShareInfo = Wire<typeof TeachShareInfo>;

/** `POST /statements/:id/teach/share`. */
export const TeachShareResult = Schema.Struct({ sent: Schema.Literal(true) });
export type TeachShareResult = Wire<typeof TeachShareResult>;
