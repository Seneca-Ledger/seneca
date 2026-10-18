import * as Schema from 'effect/Schema';
import type { Wire } from '../common/wire';

/**
 * What the shared integration page reads from any `…/status` (and settings
 * save) answer: IMAP, WebDAV, S3, SMTP, AI providers, Telegram, the bank feed.
 * Each endpoint's own contract says the rest.
 */
export const IntegrationConnection = Schema.Struct({
  connected: Schema.Boolean,
  status: Schema.String,
  /** Where the settings come from; `env` ones cannot be disconnected here. */
  source: Schema.optional(Schema.String),
  settings: Schema.optional(Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown))),
});
export type IntegrationConnection = Wire<typeof IntegrationConnection>;

/** `GET /integrations/{webdav,s3-compatible}/files`. */
export const ProtocolFileList = Schema.Struct({
  files: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      path: Schema.String,
      size: Schema.Number,
      mimeType: Schema.String,
      modifiedAt: Schema.NullOr(Schema.String),
    }),
  ),
});
export type ProtocolFileList = Wire<typeof ProtocolFileList>;

/** `POST /integrations/{webdav,s3-compatible,imap}/sync`: files uploaded or mails imported. */
export const ProtocolSyncResult = Schema.Struct({
  ok: Schema.Boolean,
  uploaded: Schema.optional(Schema.Number),
  scanned: Schema.optional(Schema.Number),
  imported: Schema.optional(Schema.Number),
});
export type ProtocolSyncResult = Wire<typeof ProtocolSyncResult>;

/** A browse action of a settings field, such as `POST /integrations/imap/folders`. */
export const BrowseOptionList = Schema.Array(Schema.String);
export type BrowseOptionList = Wire<typeof BrowseOptionList>;
