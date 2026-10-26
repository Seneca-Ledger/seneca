import * as Schema from 'effect/Schema';
import { optionalNullable } from '../common/requests';
import type { Wire } from '../common/wire';

export const CommitImportBody = Schema.Struct({
  /** Transaction index → what to do with that conflicting row. */
  resolutions: optionalNullable(
    Schema.Record(
      Schema.String.check(Schema.isPattern(/^-?\d+$/)),
      Schema.Literals(['skip', 'force_import', 'mark_duplicate']),
    ),
  ),
});
export type CommitImportBody = Wire<typeof CommitImportBody>;

/** `/import-sessions/:id/...`. */
export const ImportSessionParams = Schema.Struct({ id: Schema.String.check(Schema.isUUID()) });
export type ImportSessionParams = Wire<typeof ImportSessionParams>;
