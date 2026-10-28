import * as Schema from 'effect/Schema';
import { Timestamp, type Wire } from '../common/wire';

/** `GET /audit-events/activity`: recent changes in the workspace, for the dashboard. */
export const WorkspaceActivity = Schema.Struct({
  items: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      actorName: Schema.String,
      actorType: Schema.String,
      action: Schema.String,
      entityType: Schema.String,
      entityId: Schema.String,
      description: Schema.NullOr(Schema.String),
      /** Translated on the client; `description` is the fallback. */
      descriptionKey: Schema.NullOr(Schema.String),
      descriptionParams: Schema.NullOr(
        Schema.Record(Schema.String, Schema.Union([Schema.String, Schema.Number])),
      ),
      createdAt: Timestamp,
    }),
  ),
});
export type WorkspaceActivity = Wire<typeof WorkspaceActivity>;

const JsonObject = Schema.Record(Schema.String, Schema.Json);

/** What changed: before and after, or JSON Patch operations. */
const AuditEventDiff = Schema.Union([
  Schema.Struct({ before: Schema.NullOr(JsonObject), after: Schema.NullOr(JsonObject) }),
  Schema.Array(
    Schema.Struct({
      op: Schema.Literals(['add', 'remove', 'replace', 'move', 'copy', 'test']),
      path: Schema.String,
      value: Schema.optional(Schema.Json),
      from: Schema.optional(Schema.String),
    }),
  ),
]);

/** One entry of the audit log. `entityType` names a backend enum that grows: open. */
export const AuditEvent = Schema.Struct({
  id: Schema.String,
  workspaceId: Schema.NullOr(Schema.String),
  createdAt: Timestamp,
  actorType: Schema.Literals(['user', 'system', 'integration', 'ai']),
  actorId: Schema.NullOr(Schema.String),
  actorLabel: Schema.String,
  /** The member who acted, as the account menu shows them: their avatar matches it. */
  actor: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        name: Schema.String,
        email: Schema.String,
        avatarUrl: Schema.NullOr(Schema.String),
      }),
    ),
  ),
  entityType: Schema.String,
  entityId: Schema.String,
  action: Schema.Literals([
    'create',
    'update',
    'delete',
    'import',
    'link',
    'unlink',
    'match',
    'unmatch',
    'apply_rule',
    'rollback',
    'export',
  ]),
  description: Schema.NullOr(Schema.String),
  diff: Schema.NullOr(AuditEventDiff),
  meta: Schema.NullOr(
    Schema.StructWithRest(
      Schema.Struct({
        /** A translatable description: a key of the audit dictionary and its values. */
        auditDescription: Schema.optional(
          Schema.Struct({
            key: Schema.String,
            params: Schema.Record(Schema.String, Schema.Union([Schema.String, Schema.Number])),
          }),
        ),
        /** The event this one rolled back. */
        rollbackOf: Schema.optional(Schema.String),
      }),
      [Schema.Record(Schema.String, Schema.Json)],
    ),
  ),
  batchId: Schema.NullOr(Schema.String),
  severity: Schema.Literals(['info', 'warn', 'critical']),
  isUndoable: Schema.Boolean,
});
export type AuditEvent = Wire<typeof AuditEvent>;

/** `GET /audit-events/entity/:entityType/:entityId`. */
export const AuditEventList = Schema.Array(AuditEvent);
export type AuditEventList = Wire<typeof AuditEventList>;

/** `GET /audit-events`. */
export const AuditEventPage = Schema.Struct({
  data: Schema.Array(AuditEvent),
  total: Schema.Number,
  page: Schema.Number,
  limit: Schema.Number,
});
export type AuditEventPage = Wire<typeof AuditEventPage>;

/** `POST /audit-events/:id/rollback`. */
export const AuditRollbackResult = Schema.Struct({
  success: Schema.Boolean,
  message: Schema.optional(Schema.String),
  eventId: Schema.optional(Schema.String),
});
export type AuditRollbackResult = Wire<typeof AuditRollbackResult>;
