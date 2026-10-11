import * as Schema from 'effect/Schema';
import { Timestamp, type Wire } from '../common/wire';

export const WorkspaceRole = Schema.Literals(['owner', 'admin', 'member', 'viewer']);
export type WorkspaceRole = Wire<typeof WorkspaceRole>;

export const WorkspaceMemberPermissions = Schema.Struct({
  canEditStatements: Schema.optional(Schema.Boolean),
  canEditCustomTables: Schema.optional(Schema.Boolean),
  canEditCategories: Schema.optional(Schema.Boolean),
  canEditDataEntry: Schema.optional(Schema.Boolean),
  canShareFiles: Schema.optional(Schema.Boolean),
});
export type WorkspaceMemberPermissions = Wire<typeof WorkspaceMemberPermissions>;

/** One entry of `GET /workspaces`: a workspace as the caller is a member of it. */
export const WorkspaceSummary = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.NullOr(Schema.String),
  icon: Schema.NullOr(Schema.String),
  color: Schema.NullOr(Schema.String),
  backgroundImage: Schema.NullOr(Schema.String),
  currency: Schema.String,
  isFavorite: Schema.Boolean,
  settings: Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown)),
  ownerId: Schema.NullOr(Schema.String),
  createdAt: Timestamp,
  updatedAt: Timestamp,
  memberRole: Schema.optional(WorkspaceRole),
  memberPermissions: Schema.optional(Schema.NullOr(WorkspaceMemberPermissions)),
  stats: Schema.optional(
    Schema.Struct({
      integrationCount: Schema.Number,
      recentActivity: Schema.Boolean,
      memberCount: Schema.Number,
      lastAccessedAt: Schema.NullOr(Timestamp),
    }),
  ),
});
export type WorkspaceSummary = Wire<typeof WorkspaceSummary>;

export const WorkspaceList = Schema.Array(WorkspaceSummary);
export type WorkspaceList = Wire<typeof WorkspaceList>;

/** A member as `GET /workspaces/me` lists them. User fields are absent when the user row is gone. */
export const WorkspaceMember = Schema.Struct({
  /** The user's id. */
  id: Schema.String,
  /** The membership row, which is what owns transactions and wallets. */
  memberId: Schema.String,
  email: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
  avatarUrl: Schema.optional(Schema.NullOr(Schema.String)),
  timeZone: Schema.optional(Schema.NullOr(Schema.String)),
  role: WorkspaceRole,
  permissions: Schema.NullOr(WorkspaceMemberPermissions),
  joinedAt: Timestamp,
});
export type WorkspaceMember = Wire<typeof WorkspaceMember>;

export const WorkspaceInvitation = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  role: WorkspaceRole,
  permissions: Schema.NullOr(WorkspaceMemberPermissions),
  status: Schema.String,
  token: Schema.String,
  expiresAt: Schema.NullOr(Timestamp),
  createdAt: Timestamp,
  link: Schema.String,
});
export type WorkspaceInvitation = Wire<typeof WorkspaceInvitation>;

/** `GET /workspaces/me`: the caller's own (home) workspace, its members and open invitations. */
export const WorkspaceOverview = Schema.Struct({
  workspace: Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    ownerId: Schema.NullOr(Schema.String),
    createdAt: Timestamp,
  }),
  members: Schema.Array(WorkspaceMember),
  invitations: Schema.Array(WorkspaceInvitation),
});
export type WorkspaceOverview = Wire<typeof WorkspaceOverview>;

/** `GET /workspaces/:id`: the workspace with its members. */
export const WorkspaceDetail = Schema.Struct({
  ...WorkspaceSummary.fields,
  members: Schema.Array(WorkspaceMember),
});
export type WorkspaceDetail = Wire<typeof WorkspaceDetail>;

/** `GET /workspaces/invitations/:token`: public, so only what the invite page shows. */
export const InvitationPreview = Schema.Struct({
  status: Schema.Literals(['pending', 'accepted', 'cancelled', 'expired']),
  email: Schema.String,
  workspace: Schema.Struct({ id: Schema.String, name: Schema.String }),
  role: WorkspaceRole,
  expiresAt: Schema.NullOr(Timestamp),
});
export type InvitationPreview = Wire<typeof InvitationPreview>;
