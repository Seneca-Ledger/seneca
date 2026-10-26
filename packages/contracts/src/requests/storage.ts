import * as Schema from 'effect/Schema';
import {
  BooleanInput,
  DateOnlyInput,
  Email,
  IsoDateString,
  optionalNullable,
  StringListInput,
} from '../common/requests';
import type { Wire } from '../common/wire';

export const UpdateFileCategoryBody = Schema.Struct({
  categoryId: optionalNullable(Schema.String.check(Schema.isUUID())),
});
export type UpdateFileCategoryBody = Wire<typeof UpdateFileCategoryBody>;

export const UpdateFileTagsBody = Schema.Struct({
  tagIds: optionalNullable(Schema.Array(Schema.String.check(Schema.isUUID()))),
});
export type UpdateFileTagsBody = Wire<typeof UpdateFileTagsBody>;

export const MoveFileBody = Schema.Struct({
  folderId: optionalNullable(Schema.String.check(Schema.isUUID())),
});
export type MoveFileBody = Wire<typeof MoveFileBody>;

export const CreateTagBody = Schema.Struct({
  name: Schema.String.check(Schema.isMaxLength(64)),
  color: optionalNullable(Schema.String.check(Schema.isMaxLength(16))),
  description: optionalNullable(Schema.String.check(Schema.isMaxLength(500))),
  tagDate: optionalNullable(DateOnlyInput),
});
export type CreateTagBody = Wire<typeof CreateTagBody>;

export const UpdateTagBody = Schema.Struct({
  name: optionalNullable(Schema.String.check(Schema.isMaxLength(64))),
  color: optionalNullable(Schema.String.check(Schema.isMaxLength(16))),
  description: optionalNullable(Schema.String.check(Schema.isMaxLength(500))),
  tagDate: optionalNullable(DateOnlyInput),
});
export type UpdateTagBody = Wire<typeof UpdateTagBody>;

/** `/tags/:id`. */
export const TagIdParams = Schema.Struct({ id: Schema.String.check(Schema.isUUID()) });
export type TagIdParams = Wire<typeof TagIdParams>;

export const CreateFolderBody = Schema.Struct({
  name: Schema.String.check(Schema.isMaxLength(128)),
  parentId: optionalNullable(Schema.String),
  tagId: optionalNullable(Schema.String.check(Schema.isUUID())),
});
export type CreateFolderBody = Wire<typeof CreateFolderBody>;

export const UpdateFolderBody = Schema.Struct({
  name: optionalNullable(Schema.String.check(Schema.isMaxLength(128))),
  tagId: optionalNullable(Schema.String.check(Schema.isUUID())),
});
export type UpdateFolderBody = Wire<typeof UpdateFolderBody>;

export const CreateFileVersionBody = Schema.Struct({
  note: optionalNullable(Schema.String),
});
export type CreateFileVersionBody = Wire<typeof CreateFileVersionBody>;

export const StorageViewBody = Schema.Struct({
  name: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(128)),
  /** The page's own filter state, stored as is and handed back to it. */
  filters: optionalNullable(Schema.Record(Schema.String, Schema.Unknown)),
});
export type StorageViewBody = Wire<typeof StorageViewBody>;

/**
 * DTO for creating a shared link
 */
export const CreateSharedLinkBody = Schema.Struct({
  permission: Schema.Literals(['view', 'download', 'edit']),
  expiresAt: optionalNullable(IsoDateString),
  password: optionalNullable(Schema.String),
  allowAnonymous: optionalNullable(Schema.Boolean),
  description: optionalNullable(Schema.String),
});
export type CreateSharedLinkBody = Wire<typeof CreateSharedLinkBody>;

/**
 * DTO for updating a shared link
 */
export const UpdateSharedLinkBody = Schema.Struct({
  permission: optionalNullable(Schema.Literals(['view', 'download', 'edit'])),
  expiresAt: optionalNullable(IsoDateString),
  password: optionalNullable(Schema.String),
  status: optionalNullable(Schema.Literals(['active', 'expired', 'revoked'])),
  allowAnonymous: optionalNullable(Schema.Boolean),
  description: optionalNullable(Schema.String),
});
export type UpdateSharedLinkBody = Wire<typeof UpdateSharedLinkBody>;

export const BulkFileActionBody = Schema.Struct({
  statementIds: Schema.Array(Schema.String.check(Schema.isUUID())).check(Schema.isMinLength(1)),
});
export type BulkFileActionBody = Wire<typeof BulkFileActionBody>;

/**
 * DTO for granting file permission to a user
 */
export const GrantPermissionBody = Schema.Struct({
  /** The member to share with: their user id, or the email they sign in with. */
  userId: Schema.Union([Schema.String.check(Schema.isUUID()), Email]),
  permissionType: Schema.Literals(['owner', 'editor', 'viewer', 'downloader']),
  canReshare: optionalNullable(Schema.Boolean),
  expiresAt: optionalNullable(IsoDateString),
});
export type GrantPermissionBody = Wire<typeof GrantPermissionBody>;

/**
 * DTO for updating file permission
 */
export const UpdatePermissionBody = Schema.Struct({
  permissionType: optionalNullable(Schema.Literals(['owner', 'editor', 'viewer', 'downloader'])),
  canReshare: optionalNullable(Schema.Boolean),
  expiresAt: optionalNullable(IsoDateString),
  isActive: optionalNullable(Schema.Boolean),
});
export type UpdatePermissionBody = Wire<typeof UpdatePermissionBody>;

/**
 * `/storage/files/:id…`, `/storage/tags/:id`, `/storage/folders/:id`,
 * `/storage/views/:id`, `/storage/shares/:id`, `/storage/permissions/:id`:
 * the record's uuid.
 */
export const StorageIdParams = Schema.Struct({ id: Schema.String.check(Schema.isUUID()) });
export type StorageIdParams = Wire<typeof StorageIdParams>;

/** `/storage/shared/:token…`: a share token (64 hex characters, as the column holds). */
export const SharedLinkTokenParams = Schema.Struct({
  token: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(64)),
});
export type SharedLinkTokenParams = Wire<typeof SharedLinkTokenParams>;

/** `GET /storage/files`. */
export const StorageFilesQuery = Schema.Struct({
  search: Schema.optional(Schema.String),
  bank: Schema.optional(Schema.String),
  availability: Schema.optional(Schema.Literals(['disk', 'db', 'both', 'missing'])),
  scope: Schema.optional(Schema.Literals(['mine', 'shared', 'all'])),
  folderId: Schema.optional(Schema.String.check(Schema.isUUID())),
  /** Repeated keys or comma-separated. */
  tagIds: Schema.optional(StringListInput),
  deleted: Schema.optional(Schema.Literals(['only', 'include'])),
});
export type StorageFilesQuery = Wire<typeof StorageFilesQuery>;

/** `DELETE /storage/folders/:id`. */
export const DeleteFolderQuery = Schema.Struct({
  /** `true` deletes the folder's files too; otherwise they move to the root. */
  deleteFiles: Schema.optional(BooleanInput),
});
export type DeleteFolderQuery = Wire<typeof DeleteFolderQuery>;
