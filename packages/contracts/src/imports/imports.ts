import * as Schema from 'effect/Schema';
import type { Wire } from '../common/wire';

const ImportTarget = Schema.Literals([
  'transactions',
  'subscriptions',
  'payables',
  'invoices',
  'budgets',
  'metals',
]);

/** `POST /entity-imports/suggest`: what a pasted sheet most likely is, by column roles. */
export const ImportSuggestion = Schema.Struct({
  /** `table` when the rows fit no entity: they go into a custom table. */
  target: Schema.Union([ImportTarget, Schema.Literal('table')]),
  confidence: Schema.Number,
  columns: Schema.Array(
    Schema.Struct({ index: Schema.Number, role: Schema.NullOr(Schema.String) }),
  ),
  alternatives: Schema.Array(Schema.Struct({ target: ImportTarget, confidence: Schema.Number })),
  source: Schema.Literals(['heuristic', 'ai']),
});
export type ImportSuggestion = Wire<typeof ImportSuggestion>;

/** `POST /entity-imports`: what each row became; a dry run creates nothing. */
export const EntityImportResult = Schema.Struct({
  batchId: Schema.NullOr(Schema.String),
  target: ImportTarget,
  dryRun: Schema.Boolean,
  counts: Schema.Struct({
    created: Schema.Number,
    updated: Schema.Number,
    skipped: Schema.Number,
    errors: Schema.Number,
  }),
  rows: Schema.Array(
    Schema.Struct({
      index: Schema.Number,
      status: Schema.Literals(['created', 'updated', 'skipped', 'error']),
      reason: Schema.optional(Schema.String),
      id: Schema.optional(Schema.String),
    }),
  ),
  createdIds: Schema.Array(Schema.String),
});
export type EntityImportResult = Wire<typeof EntityImportResult>;
