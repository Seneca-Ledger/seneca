# Group 1 — auth, users, workspaces, api-keys, versions, view-preferences, application-settings, system-update, observability

Audited at origin/main 43af3ca7 (detached worktree). All paths below are relative to `backend/src/` unless noted. Guards verified: `CsrfGuard`, `JwtAuthGuard` (`@Public()`), `ThrottlerGuard` global; `WorkspaceContextGuard` + `PermissionsGuard` only via `@WorkspaceAuth`; `StripKeysInterceptor(SERVER_ONLY_KEYS)` outermost; `passwordHash`, `twoFactorSecret`, `twoFactorRecoveryCodes`, `wrappedDataKey` are `select: false` on the entities.

## Findings

| Sev | Conf | Module | file:line | Title |
|---|---|---|---|---|
| HIGH | CONFIRMED | workspaces | `modules/workspaces/workspaces.service.ts:555`, `packages/contracts/src/requests/workspaces.ts:71` | Any workspace admin can invite a second, irremovable OWNER-role member |
| HIGH | CONFIRMED | workspaces | `modules/workspaces/workspaces.service.ts:777-807` | Accepted invitation token stays valid: a removed member re-adds themselves |
| HIGH | CONFIRMED | workspaces+auth+users | `workspaces.service.ts:201-204`, `auth.service.ts:190-233`, `users.service.ts:170-212` | Pending invitation tokens leak to every home-workspace member; combined with unverified e-mail (register / PUT /users/:id) anyone can claim an admin invite |
| HIGH | CONFIRMED | api-keys/auth | `common/guards/jwt-auth.guard.ts:66-79`, every `@UseGuards(JwtAuthGuard)`-only route | Scoped API keys are unscoped on routes without `@WorkspaceAuth` (delete workspace, transfer ownership, invite admins, change user roles) |
| MEDIUM | CONFIRMED | users | `modules/users/users.service.ts:170-212`, `contracts/requests/users.ts:122-129` | `PUT /users/:id` changes own e-mail with no verification and no password, bypassing EmailChangeService |
| MEDIUM | LIKELY | api-keys | `modules/api-keys/api-keys.service.ts:39-40`, `contracts/requests/api-keys.ts:72` | `scopes: []` is turned into `null` = legacy unrestricted key (reaches USER_MANAGE / API_KEY_MANAGE) |
| MEDIUM | CONFIRMED | application-settings/workspaces | `application-settings.service.ts:810-818`, `workspaces.service.ts:1259`, `:1337-1338` | Invitation e-mails for workspace B are sent through the inviter's HOME workspace (A) SMTP credentials and public URL |
| MEDIUM | LIKELY | application-settings | `application-settings.service.ts:286-317`, `:319-358`, `:360-384` | Workspace admin sets arbitrary `localModelPath` (filesystem probe, model dir shared instance-wide and overwritable by any workspace admin) |
| LOW | CONFIRMED | workspaces | `workspaces.controller.ts:52-78`, `workspaces.service.ts:656-673` | Invitation link host taken from Origin/Referer/X-Forwarded-Host when no public URL is configured (phishing-grade link in a legitimate mail) |
| LOW | CONFIRMED | auth | `modules/auth/auth.service.ts:263-265` | Login answers "User account is inactive" before the password check (enumerates deactivated accounts) |
| LOW | CONFIRMED | auth | `modules/auth/auth.controller.ts:131-175` | `2fa/setup`, `2fa/disable`, `2fa/recovery-codes` verify the password without a `@Throttle` (online password oracle for a stolen session; only `2fa/enable` is throttled) |
| LOW | CONFIRMED | auth | `modules/auth/two-factor.service.ts:154-160` | Recovery-code burn is read-then-write, not atomic (same code accepted by two concurrent logins) |
| LOW | CONFIRMED | observability | `modules/observability/metrics.controller.ts:14-17` | `/metrics` is public whenever `METRICS_AUTH_TOKEN` is unset outside `NODE_ENV=production` |
| LOW | CONFIRMED | workspaces | `workspaces.service.ts:1200-1222` | `PATCH /workspaces/:id/favorite` lets a viewer flip a workspace-wide flag (`isFavorite` is on `workspaces`, not per member) |
| LOW | CONFIRMED | application-settings | `application-settings.controller.ts:84-88`, `:110-115`, `:137-141` | SMTP host/user/from, Telegram timeout and publicUrl are readable by every member incl. viewers (no permission on the GET routes) |
| LOW | CONFIRMED | auth | `strategies/jwt.strategy.ts:40-42` vs `auth.service.ts:64-67` | Access tokens are signed with `JWT_SECRET` but verified with `JWT_ACCESS_SECRET || JWT_SECRET` — setting `JWT_ACCESS_SECRET` breaks login (functional, not exploitable) |

### 1. Any workspace admin can invite an irremovable OWNER-role member (HIGH, CONFIRMED)

Path: `POST /workspaces/:id/invitations` (JwtAuthGuard only) → `WorkspacesService.inviteMember` → `requireAdminMembership` (OWNER **or ADMIN** passes) → `role = toEnum(WorkspaceRole, dto.role) || MEMBER` → invitation row `role: 'owner'` → `acceptInvitation` saves `workspace_members.role = invitation.role`.

`InviteMemberBody.role` is `Literals(['owner','admin','member','viewer','accountant'])` and nothing in the service restricts `'owner'` or requires the inviter to be the owner. The resulting member has `role = OWNER` while `workspaces.owner_id` still points at the real owner.

Exploit: Mallory is ADMIN of workspace W (owner Alice). She invites her second account `mallory2@x` with `role: 'owner'`, accepts it. `mallory2` is now OWNER-role: `workspaceRoleAllows` grants everything; `removeMember` refuses (`member.role === OWNER → MEMBER_CANNOT_REMOVE_OWNER`, line 782); `updateMemberRole` refuses to demote (`WORKSPACE_TRANSFER_OWNERSHIP_FIRST`, line 660). Alice cannot get rid of the account except by deleting the workspace. Also `assertNotSoleOwner` (account-data.service.ts:153) now counts two owners, so Alice may delete her own account leaving the squatter as the only owner-role member.

Evidence:
```ts
// workspaces.service.ts:555
const role = toEnum(WorkspaceRole, dto.role) || WorkspaceRole.MEMBER;
// workspaces.service.ts:501-503 (removeMember)
if (member.role === WorkspaceRole.OWNER || member.userId === workspace.ownerId) {
  throw new ForbiddenException(appError('MEMBER_CANNOT_REMOVE_OWNER'));
```
Fix: reject `role === OWNER` in `inviteMember` (ownership is transferred only via `updateMemberRole`), and in `acceptInvitation` never write OWNER from an invitation. Tests: none (`@tests/e2e/workspaces.e2e-spec.ts` has no owner-invite case).

### 2. Accepted invitation token stays valid; removed member re-joins (HIGH, CONFIRMED)

Path: `POST /workspaces/invitations/:token/accept` (or legacy `POST /workspaces/invitations/accept`) → `acceptInvitation`. Status check explicitly allows `ACCEPTED`:
```ts
// workspaces.service.ts:777-784
if (![WorkspaceInvitationStatus.PENDING, WorkspaceInvitationStatus.ACCEPTED].includes(invitation.status)) throw ...
// :798-807
if (!existingMembership) { await this.workspaceMemberRepository.save({ ..., role: invitation.role, ... }); memberAdded = true; }
```
`removeMember` (line 757-530) deletes only the membership row; the invitation keeps `status = accepted`, and the token is still in the invitee's mailbox and in `GET /workspaces/me` of the home workspace. Expiry (`expiresAt`) is only enforced while status is PENDING.

Exploit: Bob was invited to W as ADMIN, accepted, later demoted to viewer and removed. Bob replays `POST /workspaces/invitations/<token>/accept` → membership recreated **with the original invitation role (ADMIN)**, no owner action involved. Token is a UUID, kept forever (no cleanup on remove).

Fix: accept only `PENDING`; on `removeMember`/`cancelInvitation` set the invitation to CANCELLED; ideally delete the token after acceptance. Tests: none.

### 3. Pending invitation tokens exposed to all home-workspace members + unverified e-mail → claim any invite (HIGH, CONFIRMED)

Three independently-verified pieces:

a) `GET /workspaces/me` (JwtAuthGuard only) → `getWorkspaceOverview(user)` → `ensureUserWorkspace` (home workspace) → returns every PENDING invitation **with `token` and `link`** to any member, viewers included (`workspaces.service.ts:201-204`). The admin-only `GET /workspaces/:id/invitations` correctly omits the token; `/me` does not.

b) `POST /auth/register` creates an account for any e-mail address with no verification (`auth.service.ts:198-220`). `PUT /users/:id` lets a logged-in non-admin set `email` on their own row with no verification or password (`users.service.ts:179-187, 211`; `UpdateUserBody.email` is allowed). Uniqueness is the only check.

c) `acceptInvitation` authorises purely by `currentUser.email === invitation.email` (line 757-762).

Exploit: Viewer Vic's home workspace is W (he registered through an invitation, so `users.workspace_id = W`, line 814-816). Owner invites `cfo@corp.com` as ADMIN. Vic reads `GET /workspaces/me` → token T + `email: cfo@corp.com`. If the CFO has no account yet, Vic registers `cfo@corp.com` (or `PUT /users/<vic>` `{email:'cfo@corp.com'}`) and calls `POST /workspaces/invitations/T/accept` → Vic is ADMIN of W (and the real CFO can never register that address). Also the public `GET /workspaces/invitations/:token` confirms the e-mail for any token.

Fix: strip `token`/`link` from `/workspaces/me` (or restrict the invitations block to OWNER/ADMIN); require e-mail verification for register and for the `PUT /users/:id` path (route it through EmailChangeService). Tests: none for the token exposure.

### 4. Scoped API keys are unscoped on JwtAuthGuard-only routes (HIGH, CONFIRMED)

Path: `JwtAuthGuard.authenticateWithApiKey` sets `request.user = apiKey.user` and `request.apiKey.scopes`. Scopes are only consulted by `assertPermissions` (`common/authz/request-permissions.ts:75-78`), which runs in `PermissionsGuard`, which is only attached by `@WorkspaceAuth`. Every route decorated with plain `@UseGuards(JwtAuthGuard)` executes with the full rights of the key's owner regardless of scope:

- `DELETE /workspaces/:id` (owner → deletes the whole workspace), `PATCH /workspaces/:id`, `POST /workspaces/:id/invitations` (invite admins/owner, see #1), `PATCH …/members/:userId/role` (transfer ownership), `DELETE …/members/:userId`, `POST /workspaces` (new workspaces).
- `PUT /users/:id` — if the key owner is an instance ADMIN: set any user's `role: 'admin'`, `isActive`, `permissions`.
- `/auth/2fa/*` with the owner's password, `/auth/logout-all`, `/users/me/export` (sessions, IPs, audit).

`InstanceAdminGuard` correctly refuses keys, but the user-management route above uses `@WorkspaceAuth(USER_MANAGE)` only for DELETE/permissions, not for `PUT /users/:id`.

Exploit: a leaked "read-only" key (`transaction.view`) of workspace owner Alice: `curl -H 'X-Api-Key: lum_…' -X DELETE /api/v1/workspaces/<W>` → 200, workspace gone. With an instance-admin's read-only key: `PUT /users/<attacker> {"role":"admin"}`.

Evidence:
```ts
// jwt-auth.guard.ts:66-73  — nothing else looks at request.apiKey.scopes
request.user = apiKey.user as AuthenticatedUser;
request.apiKey = { id, name, prefix, scopes: apiKey.scopes ?? null };
```
Fix: in `JwtAuthGuard.authenticateWithApiKey`, when `request.apiKey.scopes` is non-null refuse any handler that has no `PERMISSIONS_KEY` metadata (fail closed), or add a global guard that denies API-key requests on routes lacking `@RequirePermission`. Tests: `@tests/e2e/api-key-scopes.e2e-spec.ts` covers only `@WorkspaceAuth` routes.

### 5. `PUT /users/:id` — self-service unverified e-mail change (MEDIUM, CONFIRMED)

`users.service.ts:170-212`: non-admins may update their own row; `role`/`permissions` are stripped, but `email`, `isActive`, `name`, `company` are `Object.assign`ed and saved. No password check, no confirmation mail — the whole point of `EmailChangeService` (users/services/email-change.service.ts) is bypassed. Consequence: account can be pointed at a mailbox the user cannot read (breaks recovery) and it is the enabler of #3. Fix: drop `email` from the non-admin path (`if (currentUser.role !== ADMIN) updateUserDto.email = undefined`). Tests: none for this route.

### 6. `scopes: []` creates an unrestricted key (MEDIUM, LIKELY)

`CreateApiKeyBody.scopes = Schema.Array(ApiKeyScope).check(isUnique())` has no minimum length; `ApiKeysService.generate` does `options.scopes.length > 0 ? […] : null` (line 39-40) and `null` means "legacy key, full reach of owner" (`request-permissions.ts:41-42`). An instance admin (or anyone granted `api_key.manage`) can therefore mint a key carrying `api_key.manage` and `user.manage`, which `NEVER_FOR_KEYS` is meant to forbid. The e2e only tests a missing `scopes` field (400), not an empty array. Fix: `Schema.isMinLength(1)` on the contract and reject empty arrays in the service. Hypothesis part: that `effect/Schema.Array` accepts `[]` (it does by default).

### 7. Invitation mail uses the inviter's home workspace SMTP/publicUrl (MEDIUM, CONFIRMED)

`inviteMember(workspaceId=B, currentUser)` → `sendInvitationEmail({user: currentUser})` → `getSmtpSettings(params.user)` with **no `requestWorkspaceId`** → `findSettings` → `requireWorkspaceId(user, undefined)` → `user.workspaceId || user.lastWorkspaceId` (A). Same for `buildInvitationLink` → `getAppSettings(user)`. So a user who is a plain member/viewer of A (home) and admin of B sends B's invitations through A's SMTP credentials (decrypted `pass`, A's `from`) to arbitrary addresses with attacker-chosen content (workspace name of B, inviter name). Tenant A's secret is used on tenant B's behalf; A's admins never see the mail. The MailerService path (`mailer.service.ts:44-47`) accepts `workspaceId` but WorkspacesService uses its own nodemailer transport. Fix: pass `workspaceId` to `getSmtpSettings`/`getAppSettings` in `sendInvitationEmail` and `buildInvitationLink`. Tests: none.

### 8. Workspace-admin-controlled `localModelPath` (MEDIUM, LIKELY)

`PUT /settings/local-categorization` (WORKSPACE_SETTINGS_MANAGE) stores any string as `localModelPath` and `modelId` (only `modelId` is checked for `..`/absolute segments). Then:
- `GET /settings/local-categorization` (any member) → `hasLocalCategorizationModelFiles` → `fs.access(<path>/<modelId>/config.json)` + `fs.readdir(<path>/<modelId>/onnx)` → directory/file existence oracle on the server FS.
- `POST /settings/local-categorization/test` (any member) → `TransactionCategorizer` sets `env.localModelPath` (transaction-categorizer.ts:47-48) and loads `<path>/<modelId>` with transformers.js; `modelLoadError.message` is returned verbatim (leaks parse errors / paths of arbitrary `config.json`).
- `POST /settings/local-categorization/model` extracts a 500 MB zip into `LOCAL_CATEGORIZATION_MODEL_ROOT/<modelId>` — the root is **server-wide**, so a workspace admin in tenant A replaces the ONNX model every other tenant with the same `modelId` (the default one) runs. Zip path traversal is checked; sizes bounded.
Fix: refuse `localModelPath` from the API (env only), or constrain it under `modelRoot`; make the model root per workspace or instance-admin only. "LIKELY" because I did not execute the transformers.js loader to confirm what its error strings contain.

### 9. Invitation link built from request headers (LOW, CONFIRMED)

`getRequestAppOrigin` (controller:52-78) trusts `Origin`, then `Referer`, then `X-Forwarded-Host`/`X-Forwarded-Proto`. `buildInvitationLink` uses it whenever settings publicUrl and `APP_URL`/`FRONTEND_URL` are unset or localhost. Anyone can register, create a workspace, invite `victim@x` with `Origin: https://evil.example` and the instance mails a genuine-looking invitation whose link points at the attacker. Fix: never derive the origin from request headers; require configured public URL.

### 10–16. LOW items (see table)
- Login (`auth.service.ts:263`) distinguishes inactive accounts before bcrypt → enumeration of deactivated users; make the message uniform.
- `2fa/setup`, `2fa/disable`, `2fa/recovery-codes` run `bcrypt.compare` with only the global 500/min limiter; add `@Throttle` like `me/password`.
- Recovery code: `consumeRecoveryCode` then `update` — two concurrent logins can spend the same code; use a conditional UPDATE.
- `/metrics` public outside production when the token is unset; labels are route templates (no ids), default Node metrics only.
- `toggleFavorite` writes `workspaces.is_favorite` for all members; any member (viewer) can flip it.
- SMTP host/user/from readable by viewers via GET routes with only `WorkspaceContextGuard`.
- JWT secret mismatch between sign (`JWT_SECRET`) and verify (`JWT_ACCESS_SECRET || JWT_SECRET`).

## Per-module verdicts

- **auth** — mostly solid: cookies httpOnly+SameSite, CSRF double-submit (timing-safe), refresh rotation bound to `auth_sessions.refresh_token_hash` (HMAC), session revocation checked per request, password reset tokens random 32B/HMAC/1h/single-use with neutral responses, register/login/forgot/reset throttled, invitation token checked against e-mail, recovery codes HMAC + timingSafeEqual, no secrets in audit events. Holes: no e-mail verification at register (enabler of #3), inactive-account enumeration, unthrottled password oracles on 2FA routes, non-atomic recovery-code burn, secret-env mismatch (LOW).
- **users** — `GET /users` scoped to header workspace via membership join; permission management scoped by `findUserInWorkspace` and `assertCanGrant`; avatar upload (MIME allowlist + magic bytes + timestamp name) and `@Public` avatar read (`path.basename`, pinned content type) are clean; account export strips the hash; self-delete requires password and refuses sole owners. Holes: `PUT /users/:id` unverified e-mail change (#5) and the same route being reachable by scoped API keys (#4).
- **workspaces** — all 20 routes are JwtAuthGuard-only by design and the service checks membership/role on every path; queries scoped by `workspaceId`; invitation tokens are UUIDs; version workspaces blocked from writes via `assertWritable`; demo workspace one-per-user; backgrounds: photoId UUID-pinned, egress guard on originals, re-encoded through sharp, random filename. Holes: #1 owner-role invite, #2 accepted-token reuse, #3 token exposure on `/me`, #7 home-workspace SMTP, #9 header-derived link, favorite flag (LOW).
- **api-keys** — hash (sha256) storage, list/revoke scoped by `workspaceId`, header workspace forced to the key's workspace, inactive owner refused. Holes: #4 scopes unenforced on JwtAuthGuard-only routes, #6 empty scopes = unrestricted.
- **versions** — clean: list/take/open/copy/close all require `workspace.ownerId === userId` on the **source** workspace (`readyVersion`/`ownedWorkspace`), opened copies are owned by the opener, prune/delete scoped by `workspaceId`, blob store validates uuid/sha paths, payload AES-GCM with wrapped key (`select: false`), restored documents staged under new `restored-<id>-` names so `discard` cannot delete source files, scheduler iterates STANDARD non-demo workspaces. No cross-tenant path found.
- **view-preferences** — clean: both routes `@WorkspaceAuth(TRANSACTION_VIEW)`, read/upsert keyed by (userId, workspaceId, scope); `state` is an unbounded jsonb (1 MB body cap only) — LOW DoS at most.
- **application-settings** — writes behind `WORKSPACE_SETTINGS_MANAGE`, SMTP host through `assertPublicEgressHost`, Telegram token regex-pinned before being put in a URL, secrets AES-GCM encrypted and never returned (`passConfigured`/`botTokenConfigured` only), instance Telegram bot behind `InstanceAdminGuard`. Holes: #7 home-workspace fallback used from the invitation path, #8 `localModelPath`, viewer-readable SMTP metadata (LOW).
- **system-update** — clean: `InstanceAdminGuard` (no API keys) + service re-check; the only value written to the shared volume is a GitHub tag that must match `^v\d+\.\d+\.\d+$` (via `compareReleaseTags`), status.json parsed defensively; no command execution in the backend.
- **observability** — clean apart from the dev-mode open `/metrics` (LOW); token compared with `timingSafeEqual`; route labels are templates; no tenant data in metrics.
- **common/guards, authz, strip-keys** — correct as described in the brief; `SERVER_ONLY_KEYS` covers hashes/secrets/paths; note `apiKey.keyHash` is stripped manually in the controller (not in the list) and `refreshTokenHash` is only protected by the sessions DTO mapping — consider adding `keyHash`, `refreshTokenHash`, `tokenHash`, `botToken`, `pass` to the list as belt-and-braces.

## Not checked / uncertainty

- Did not execute code; all findings are from reading. #6 and #8 are marked LIKELY where behaviour of a library (effect Schema.Array on `[]`, transformers.js error strings) was not run.
- `BackupRestoreService.restoreOpened` was only checked for file placement (safe) and ownership of the opened copy; the row-remapping logic itself belongs to the backups owner.
- `MailerService` (used by password reset / e-mail change) resolves SMTP by the user's home workspace by design; I flagged only the invitation path where a request workspace exists.
- Frontend handling of `backgroundImage` (free string up to 255 chars from `CreateWorkspaceBody`/`CompleteOnboardingBody`) was not reviewed; if rendered as `url()`/`<img src>` without an allowlist it is a `javascript:`/external-fetch concern on the client side.
- `demo-data.generator.ts` / `demo-workspace.seeder.ts` (1.1k lines of fixture generation) were skimmed, not line-audited: they write only into the freshly created demo workspace id inside one transaction.
