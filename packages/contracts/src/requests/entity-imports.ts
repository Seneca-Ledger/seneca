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
});
export type EntityImportOptionsInput = Wire<typeof EntityImportOptionsInput>;

export const RunEntityImportBody = Schema.Struct({
  target: Schema.Literals([
    'transactions',
    'subscriptions',
    'payables',
    'invoices',
    'budgets',
    'metals',
  ]),
  /** Target field → column index in `rows`. */
  mapping: Schema.Record(Schema.String, Schema.Int),
  rows: Schema.Array(Schema.Array(Schema.String)).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(5000),
  ),
  fileName: optionalNullable(Schema.String.check(Schema.isMaxLength(255))),
  /** Validate and count only; nothing is written. */
  dryRun: optionalNullable(Schema.Boolean),
  options: optionalNullable(EntityImportOptionsInput),
});
export type RunEntityImportBody = Wire<typeof RunEntityImportBody>;
