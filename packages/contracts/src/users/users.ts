import * as Schema from 'effect/Schema';
import { CurrentUser, UserRole } from '../auth/current-user';
import { Timestamp, type Wire } from '../common/wire';
import { UserPermission } from '../requests/users';

/** One row of `GET /users`: the workspace's people, for the admin page. */
export const AdminUser = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  name: Schema.String,
  role: UserRole,
  isActive: Schema.Boolean,
  /** Custom grants; null = the role's defaults. */
  permissions: Schema.NullOr(Schema.Array(UserPermission)),
  createdAt: Timestamp,
  lastLogin: Schema.NullOr(Timestamp),
});
export type AdminUser = Wire<typeof AdminUser>;

export const AdminUserList = Schema.Array(AdminUser);
export type AdminUserList = Wire<typeof AdminUserList>;

/** `GET /users/:id/permissions`. */
export const UserPermissions = Schema.Struct({
  userId: Schema.String,
  role: UserRole,
  customPermissions: Schema.Array(UserPermission),
  /** What the user can do in the end: role defaults plus custom grants. */
  allPermissions: Schema.Array(UserPermission),
});
export type UserPermissions = Wire<typeof UserPermissions>;

/** `GET /users/me/disclaimer`. */
export const DisclaimerStatus = Schema.Struct({
  /** The version the app asks for now. */
  version: Schema.String,
  acceptedAt: Schema.NullOr(Timestamp),
  acceptedVersion: Schema.NullOr(Schema.String),
  accepted: Schema.Boolean,
});
export type DisclaimerStatus = Wire<typeof DisclaimerStatus>;

/** `GET /users/timezones`: every IANA zone, labelled for a picker. */
export const TimeZoneList = Schema.Struct({
  timeZones: Schema.Array(Schema.Struct({ value: Schema.String, label: Schema.String })),
});
export type TimeZoneList = Wire<typeof TimeZoneList>;

/** `PUT /users/:id/permissions` and its add, remove and reset: the grants now stored. */
export const UserPermissionsUpdate = Schema.Struct({
  userId: Schema.String,
  /** null = back on the role's defaults. */
  permissions: Schema.NullOr(Schema.Array(UserPermission)),
  message: Schema.String,
});
export type UserPermissionsUpdate = Wire<typeof UserPermissionsUpdate>;

/** `POST /users/me/email/confirm`: the address the account now signs in with. */
export const EmailChangeConfirmed = Schema.Struct({
  email: Schema.String,
  message: Schema.String,
});
export type EmailChangeConfirmed = Wire<typeof EmailChangeConfirmed>;

/** `POST /users/me/disclaimer`: the user as `GET /auth/me` gives it, and the version accepted. */
export const DisclaimerAccepted = Schema.Struct({ user: CurrentUser, version: Schema.String });
export type DisclaimerAccepted = Wire<typeof DisclaimerAccepted>;

/** `GET /users/me`: the user as `GET /auth/me` gives it, with the disclaimer last accepted. */
export const UserProfile = Schema.Struct({
  ...CurrentUser.fields,
  disclaimerAcceptedAt: Schema.NullOr(Timestamp),
  disclaimerVersion: Schema.NullOr(Schema.String),
});
export type UserProfile = Wire<typeof UserProfile>;
