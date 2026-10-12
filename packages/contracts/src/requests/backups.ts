import * as Schema from 'effect/Schema';
import { optionalNullable } from '../common/requests';
import type { Wire } from '../common/wire';

/**
 * `PUT /backups/config`: the writable settings only. Format checks with their
 * own messages (HH:mm, a real time zone, the path alphabet) stay in the service.
 */
export const UpdateBackupConfigurationBody = Schema.Struct({
  destinationKind: Schema.Literals(['nextcloud', 'local']),
  destinationPath: optionalNullable(Schema.String),
  dailyTime: optionalNullable(Schema.String),
  timeZone: optionalNullable(Schema.String),
  retentionCount: optionalNullable(Schema.Int),
  enabled: optionalNullable(Schema.Boolean),
  /** Sent once to set up encryption; omitted keeps the stored key. */
  password: optionalNullable(Schema.String),
});
export type UpdateBackupConfigurationBody = Wire<typeof UpdateBackupConfigurationBody>;

/** The form fields next to the archive in a backup preview or restore. */
export const BackupImportBody = Schema.Struct({
  password: Schema.String,
  workspaceName: optionalNullable(Schema.String),
});
export type BackupImportBody = Wire<typeof BackupImportBody>;
