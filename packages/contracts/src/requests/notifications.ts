import * as Schema from 'effect/Schema';
import type { Wire } from '../common/wire';

export const MarkReadBody = Schema.Struct({
  ids: Schema.Array(Schema.String.check(Schema.isUUID())).check(Schema.isMinLength(1)),
});
export type MarkReadBody = Wire<typeof MarkReadBody>;

export const UpdateNotificationPreferencesBody = Schema.Struct({
  /**
   * Per-event channel matrix, keyed by preference key (e.g. `statementUploaded`).
   * The service still normalises it against the known keys.
   */
  channels: Schema.optional(
    Schema.Record(
      Schema.String,
      Schema.Struct({
        inApp: Schema.optional(Schema.Boolean),
        email: Schema.optional(Schema.Boolean),
        telegram: Schema.optional(Schema.Boolean),
        push: Schema.optional(Schema.Boolean),
      }),
    ),
  ),
  digestMode: Schema.optional(Schema.Literals(['instant', 'daily', 'weekly'])),
  quietHoursStart: Schema.optional(
    Schema.NullOr(
      Schema.Int.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(23)),
    ),
  ),
  quietHoursEnd: Schema.optional(
    Schema.NullOr(
      Schema.Int.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(23)),
    ),
  ),
  statementUploaded: Schema.optional(Schema.Boolean),
  importCommitted: Schema.optional(Schema.Boolean),
  categoryChanges: Schema.optional(Schema.Boolean),
  memberActivity: Schema.optional(Schema.Boolean),
  dataDeleted: Schema.optional(Schema.Boolean),
  workspaceUpdated: Schema.optional(Schema.Boolean),
  parsingErrors: Schema.optional(Schema.Boolean),
  importFailures: Schema.optional(Schema.Boolean),
  uncategorizedItems: Schema.optional(Schema.Boolean),
  subscriptionPrompts: Schema.optional(Schema.Boolean),
});
export type UpdateNotificationPreferencesBody = Wire<typeof UpdateNotificationPreferencesBody>;
