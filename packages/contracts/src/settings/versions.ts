import * as Schema from 'effect/Schema';
import { DecimalString, Timestamp, type Wire } from '../common/wire';

/**
 * One row of `GET /versions`, newest first: the workspace as it was at
 * `takenAt`, nightly or taken by hand. Never the key or where it is stored.
 */
export const WorkspaceVersion = Schema.Struct({
  id: Schema.String,
  takenAt: Timestamp,
  trigger: Schema.Literals(['manual', 'scheduled']),
  status: Schema.Literals(['running', 'ready', 'failed']),
  /** Rows per table, e.g. `{ transactions: 312, statements: 14 }`. */
  rowCounts: Schema.Record(Schema.String, Schema.Number),
  /** bigint column: a decimal string. */
  sizeBytes: DecimalString,
  errorMessage: Schema.NullOr(Schema.String),
});
export type WorkspaceVersion = Wire<typeof WorkspaceVersion>;

export const WorkspaceVersionList = Schema.Array(WorkspaceVersion);
export type WorkspaceVersionList = Wire<typeof WorkspaceVersionList>;

/** `POST /versions/:id/open` and `/copy`: the workspace to switch to. */
export const OpenedWorkspaceVersion = Schema.Struct({
  workspaceId: Schema.String,
  name: Schema.String,
});
export type OpenedWorkspaceVersion = Wire<typeof OpenedWorkspaceVersion>;

/** `POST /versions/:id/copy`: the copy's name; by default "<workspace> — <day>". */
export const CopyWorkspaceVersionBody = Schema.Struct({
  name: Schema.optional(Schema.NullOr(Schema.String.check(Schema.isMaxLength(255)))),
});
export type CopyWorkspaceVersionBody = Wire<typeof CopyWorkspaceVersionBody>;
