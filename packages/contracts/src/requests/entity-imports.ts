import * as Schema from 'effect/Schema';
import { optionalNullable } from '../common/requests';
import type { Wire } from '../common/wire';

export const SuggestImportBody = Schema.Struct({
  headers: Schema.Array(Schema.String).check(Schema.isMaxLength(60)),
  samples: optionalNullable(
    Schema.Array(Schema.Array(Schema.String)).check(Schema.isMaxLength(20)),
  ),
});
export type SuggestImportBody = Wire<typeof SuggestImportBody>;

export const EntityImportOptionsInput = Schema.Struct({
  /** Fallback currency for rows that carry none. */
  currency: optionalNullable(Schema.String.check(Schema.isBetweenLength(3, 3))),
  /** Transactions only: run the categorizer over rows without a category. */
  categorize: optionalNullable(Schema.Boolean),
  /** Transactions only: the account the rows came from. */
  walletId: optionalNullable(Schema.String.check(Schema.isUUID())),
});
export type EntityImportOptionsInput = Wire<typeof EntityImportOptionsInput>;

const EntityImportTarget = Schema.Literals([
  'transactions',
  'subscriptions',
  'payables',
  'invoices',
  'budgets',
  'metals',
]);

export const RunEntityImportBody = Schema.Struct({
  target: EntityImportTarget,
  /** Target field → column index in `rows`. */
  mapping: Schema.Record(Schema.String, Schema.Int),
  rows: Schema.Array(Schema.Array(Schema.String)).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(5000),
  ),
  fileName: optionalNullable(Schema.String.check(Schema.isMaxLength(255))),
  /** The sheet's header row: tells one bank's export from another's. */
  headers: optionalNullable(Schema.Array(Schema.String).check(Schema.isMaxLength(60))),
  /** Validate and count only; nothing is written. */
  dryRun: optionalNullable(Schema.Boolean),
  options: optionalNullable(EntityImportOptionsInput),
});
export type RunEntityImportBody = Wire<typeof RunEntityImportBody>;

/** `DELETE /entity-imports/:batchId`: an import batch id (uuid). */
export const EntityImportBatchParams = Schema.Struct({
  batchId: Schema.String.check(Schema.isUUID()),
});
export type EntityImportBatchParams = Wire<typeof EntityImportBatchParams>;

/** `POST /entity-imports/mapping-profiles/match`: the header row of the sheet being imported. */
export const MatchImportMappingBody = Schema.Struct({
  target: EntityImportTarget,
  headers: Schema.Array(Schema.String).check(Schema.isMaxLength(60)),
});
export type MatchImportMappingBody = Wire<typeof MatchImportMappingBody>;

/** `PUT /entity-imports/mapping-profiles`: remember the column roles for sheets with these headers. */
export const SaveImportMappingBody = Schema.Struct({
  target: EntityImportTarget,
  headers: Schema.Array(Schema.String).check(Schema.isMinLength(1), Schema.isMaxLength(60)),
  /** Target field → column index, as in `RunEntityImportBody`. */
  mapping: Schema.Record(Schema.String, Schema.Int),
});
export type SaveImportMappingBody = Wire<typeof SaveImportMappingBody>;

/** `DELETE /entity-imports/mapping-profiles/:id`: a remembered mapping id (uuid). */
export const ImportMappingProfileParams = Schema.Struct({
  id: Schema.String.check(Schema.isUUID()),
});
export type ImportMappingProfileParams = Wire<typeof ImportMappingProfileParams>;
