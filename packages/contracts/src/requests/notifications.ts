import * as Schema from 'effect/Schema';
import { NumericInput, optionalNullable } from '../common/requests';
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
  channels: optionalNullable(
    Schema.Record(
      Schema.String,
      Schema.Struct({
        inApp: optionalNullable(Schema.Boolean),
        email: optionalNullable(Schema.Boolean),
        telegram: optionalNullable(Schema.Boolean),
        push: optionalNullable(Schema.Boolean),
      }),
    ),
  ),
  digestMode: optionalNullable(Schema.Literals(['instant', 'daily', 'weekly'])),
  quietHoursStart: optionalNullable(
    Schema.Int.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(23)),
  ),
  quietHoursEnd: optionalNullable(
    Schema.Int.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(23)),
  ),
  statementUploaded: optionalNullable(Schema.Boolean),
  importCommitted: optionalNullable(Schema.Boolean),
  categoryChanges: optionalNullable(Schema.Boolean),
  memberActivity: optionalNullable(Schema.Boolean),
  dataDeleted: optionalNullable(Schema.Boolean),
  workspaceUpdated: optionalNullable(Schema.Boolean),
  parsingErrors: optionalNullable(Schema.Boolean),
  importFailures: optionalNullable(Schema.Boolean),
  uncategorizedItems: optionalNullable(Schema.Boolean),
  subscriptionPrompts: optionalNullable(Schema.Boolean),
});
export type UpdateNotificationPreferencesBody = Wire<typeof UpdateNotificationPreferencesBody>;

/** `GET /notifications`: a page of the bell (30 from the start when absent). */
export const NotificationsQuery = Schema.Struct({
  limit: Schema.optional(NumericInput),
  offset: Schema.optional(NumericInput),
  /** Sent by the bell and ignored: the workspace is the one the guard resolved. */
  workspaceId: Schema.optional(Schema.String),
});
export type NotificationsQuery = Wire<typeof NotificationsQuery>;
