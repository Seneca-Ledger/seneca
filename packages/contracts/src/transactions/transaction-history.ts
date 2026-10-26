import * as Schema from 'effect/Schema';
import { Timestamp, type Wire } from '../common/wire';

/** The fields of a row its history speaks of; the rest of the audit snapshot is bookkeeping. */
export const TransactionHistoryField = Schema.Literals([
  'category',
  'payee',
  'amount',
  'currency',
  'type',
  'date',
  'name',
  'purpose',
  'account',
  'owner',
  'private',
  'confirmed',
  'comment',
]);
export type TransactionHistoryField = Wire<typeof TransactionHistoryField>;

/**
 * `GET /transactions/:id/history`: what happened to one row, newest first, in
 * words a person reads. Values are names, not ids (a category, payee, account
 * or member that is gone reads as null), dates and amounts stay raw for the
 * viewer's locale.
 */
export const TransactionHistory = Schema.Struct({
  /** Where the row came from: its statement's file name, or null when added by hand. */
  origin: Schema.Struct({ at: Timestamp, statementName: Schema.NullOr(Schema.String) }),
  currency: Schema.String,
  entries: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      at: Timestamp,
      kind: Schema.Literals(['changed', 'created', 'split', 'unsplit', 'rule', 'attachment']),
      /** Who did it: the viewer, another member (by name), a rule, or the app itself. */
      actor: Schema.Struct({
        kind: Schema.Literals(['you', 'member', 'rule', 'system']),
        name: Schema.NullOr(Schema.String),
      }),
      /** Only the fields that really changed. */
      changes: Schema.Array(
        Schema.Struct({
          field: TransactionHistoryField,
          before: Schema.NullOr(Schema.String),
          after: Schema.NullOr(Schema.String),
        }),
      ),
      /** Split parts, for `split` and `unsplit`. */
      parts: Schema.NullOr(Schema.Number),
      /** It can be put back: every field still holds what this change wrote. */
      canUndo: Schema.Boolean,
    }),
  ),
});
export type TransactionHistory = Wire<typeof TransactionHistory>;
