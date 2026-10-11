import * as Schema from 'effect/Schema';
import { NumericInput, optionalNullable } from '../common/requests';
import type { Wire } from '../common/wire';

/**
 * These bodies were typed `Record<string, unknown>`, which leaves the global
 * ValidationPipe with an `Object` metatype and therefore nothing to validate —
 * `whitelist` and `forbidNonWhitelisted` both become no-ops. The controller's
 * own stringValue/numberValue coercion stays: it decides the shape handed to
 * the service, while these DTOs reject unknown properties at the boundary.
 */
export const SaveS3SettingsBody = Schema.Struct({
  endpoint: optionalNullable(Schema.String),
  region: optionalNullable(Schema.String),
  bucket: optionalNullable(Schema.String),
  prefix: optionalNullable(Schema.String),
  accessKeyId: optionalNullable(Schema.String),
  secretAccessKey: optionalNullable(Schema.String),
  forcePathStyle: optionalNullable(Schema.Boolean),
  autoBackup: optionalNullable(Schema.Boolean),
});
export type SaveS3SettingsBody = Wire<typeof SaveS3SettingsBody>;

export const ImportFilesBody = Schema.Struct({
  fileIds: optionalNullable(Schema.Array(Schema.String)),
});
export type ImportFilesBody = Wire<typeof ImportFilesBody>;

export const SaveWebdavSettingsBody = Schema.Struct({
  url: optionalNullable(Schema.String),
  rootPath: optionalNullable(Schema.String),
  username: optionalNullable(Schema.String),
  password: optionalNullable(Schema.String),
});
export type SaveWebdavSettingsBody = Wire<typeof SaveWebdavSettingsBody>;

export const SaveImapSettingsBody = Schema.Struct({
  host: optionalNullable(Schema.String),
  port: optionalNullable(
    NumericInput.check(
      Schema.isInt(),
      Schema.isGreaterThanOrEqualTo(1),
      Schema.isLessThanOrEqualTo(65535),
    ),
  ),
  secure: optionalNullable(Schema.Boolean),
  mailbox: optionalNullable(Schema.String),
  user: optionalNullable(Schema.String),
  pass: optionalNullable(Schema.String),
});
export type SaveImapSettingsBody = Wire<typeof SaveImapSettingsBody>;

export const ListImapFoldersBody = Schema.Struct({
  host: optionalNullable(Schema.String),
  port: optionalNullable(
    NumericInput.check(
      Schema.isInt(),
      Schema.isGreaterThanOrEqualTo(1),
      Schema.isLessThanOrEqualTo(65535),
    ),
  ),
  secure: optionalNullable(Schema.Boolean),
  user: optionalNullable(Schema.String),
  pass: optionalNullable(Schema.String),
});
export type ListImapFoldersBody = Wire<typeof ListImapFoldersBody>;
