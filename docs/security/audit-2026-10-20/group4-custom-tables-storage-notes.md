# Group 4 — custom-tables, data-entry, notes, storage, vendor-icons, maps, geocoding

Code read at origin/main 43af3ca7 (audit worktree). Every controller, service, helper, scheduler/processor and the touched entities in the seven modules were read in full; the verdicts below are from the traced code paths, not from grep.

## Findings

| Sev | Conf | Module | file:line | Title |
|---|---|---|---|---|
| HIGH | CONFIRMED | custom-tables | `custom-table-export-schedules.service.ts:143-149` (+ `common/utils/filename.util.ts:16`) | Scheduled export writes to an attacker-chosen path: table name is joined into the file path unsanitised (`..`/`/` traversal), content partly attacker-controlled |
| MEDIUM | CONFIRMED | custom-tables | `sources/transactions.source.ts:35-90` | "Fill from app" copies private transactions' merchant/purpose into a table readable by every member, exportable and publicly shareable (no `redactPrivateRows`) |
| MEDIUM | CONFIRMED | storage | `storage.service.ts:1405-1420` | Uploader keeps full access (view/download/edit/share/permanent delete) to files in a workspace they are no longer a member of |
| MEDIUM | CONFIRMED | storage | `storage.service.ts:744-780` | Statement CSV export skips `redactPrivateRows`: any member exports other members' private rows in clear |
| MEDIUM | CONFIRMED | storage | `storage.service.ts:782-800` | `bulkDelete` hard-deletes statements straight from the repository: bypasses trash, `statementsService` audit/file cleanup and the tax-lock guard; cascades tax-locked transactions |
| LOW | CONFIRMED | custom-tables | `custom-tables.service.ts:4075-4091` | CSV export header row and summary titles are not formula-neutralised (column titles / summary titles are editor input) |
| LOW | CONFIRMED | custom-tables | `custom-table-shares.controller.ts:63-77` | `GET /custom-tables/:id/shares` returns the live public token to every member including viewers (viewers cannot create links but can read and redistribute existing ones) |
| LOW | LIKELY | storage | `storage.service.ts:1150-1160, 591-603` | Public share links survive the file being trashed; a `FilePermission` grant survives the grantee leaving the workspace |
| LOW | LIKELY | notes | `notes.service.ts:107-118` | Notes on a private transaction are readable by every member (target check is workspace-only, no owner/`isPrivate` check) — the owner's own note text can leak what the row was |
| LOW | CONFIRMED | data-entry | `data-entry.service.ts:217-236` | "Hide base tab" is a per-user preference that deletes the whole workspace's entries of that type for everyone |
| LOW | CONFIRMED | data-entry | `data-entry.controller.ts:140-176` | Icon upload into a public static mount has no permission check, no quota, per-file 1.5 MB (any member incl. viewer; MIME trusted from client but extension forced from the same MIME) |
| LOW | CONFIRMED | vendor-icons | `vendor-icons.controller.ts:22-23` | `@SkipThrottle` on an upstream-fetching proxy: any signed-in user can drive unbounded DuckDuckGo requests (one 3 s fetch per fresh domain) |

### 1. HIGH — Scheduled export path traversal (custom-tables)

Path: `POST /custom-tables/:id/export-schedules` (JwtAuthGuard + WorkspaceContextGuard, service checks `canEditCustomTables`) → row in `custom_table_export_schedules` → hourly `CustomTableExportSchedulesScheduler.runDueExports()` (no request) → `runSchedule(schedule.id)`:

```ts
const { buffer, fileName } = await this.customTablesService.exportRows(schedule.workspaceId, schedule.tableId, …);
// exportRows: fileName = normalizeFilename(`${table.name}.csv`)   // name ≤120 chars, any characters
const dir = path.join(resolveUploadsDir(), 'scheduled-exports');
const stamped = normalizeFilename(`${new Date().toISOString().slice(0, 10)}-${fileName}`);
const filePath = path.join(dir, `${schedule.id}-${stamped}`);
await fs.promises.writeFile(filePath, buffer);
```

`normalizeFilename` only fixes mojibake; it does not strip `/` or `..`. `CreateCustomTableBody.name` is `Schema.String` (min 1, max 120) with no character restriction. `path.join` normalises `..`. Verified: `path.join('/app/uploads/scheduled-exports', 'uuid-2026-10-19-a/../../../../../tmp/pwn.csv')` → `/tmp/pwn.csv`.

Exploit: a member with `canEditCustomTables` (or any owner/admin) in *their own* workspace: `PATCH /custom-tables/:id {"name":"a/../../../../../../etc/cron.d/x"}` (or any path writable by the backend user, e.g. the frontend/static dir, a `.ssh/authorized_keys`, a file inside another mount), creates a CSV schedule with `intervalHours: 1`, fills the table's cells with the content they want in the file (only a leading `=+-@` is neutralised; everything else lands verbatim, one cell per CSV field). Within the hour the cron writes the file as the backend process; `lastFilePath` then lets the attacker also read any file the process can read? — no, `readLastFile` reads only `schedule.lastFilePath`, which is the path just written, so read is limited to the written file; the damage is the arbitrary **write** (and overwrite of existing files: `writeFile` truncates). The directory must already exist. Not cross-tenant, but it is a server-side arbitrary file write reachable by a non-admin member.

Fix: build the stored name from a fixed-charset slug (`[A-Za-z0-9._-]`, `path.basename`, strip leading dots) or just `${schedule.id}-${date}.${format}`; additionally assert `path.resolve(filePath).startsWith(dir + path.sep)` before writing.

Existing test: `@tests/unit/custom-tables/custom-table-export-schedules.service.spec.ts` only checks the date stamp with a benign name. No test for traversal. Not covered.

### 2. MEDIUM — Private transactions copied unredacted into custom tables

Path: `POST /custom-tables/source-preview`, `POST /custom-tables/from-source`, `POST /custom-tables/:id/refresh-from-source`, `restore-default` → `CustomTablesService.fetchSourceRows` → `TransactionsSource.fetchRows(workspaceId, filters)`:

```ts
.where('tx.workspaceId = :workspaceId', { workspaceId })
.andWhere(countedSql('tx'))
…
values: { counterparty: tx.counterpartyName || '', purpose: tx.paymentPurpose || '', … }
```

No `redactPrivateRows`/`canReadPrivate` call (unlike `statements.controller.ts:483`, `storage.service.ts:324`, `review-inbox.service.ts:222`), and no member id reaches the adapter at all. The preview returns the first 20 rows of counterparty/purpose in the response; the created table stores them in `custom_table_rows.data`, which every member reads (`GET /custom-tables/:id/rows` is viewer-readable), can export, and can expose via a public share link (`public/custom-tables/:token/rows` returns raw `data`).

Exploit: member B (any role with `canEditCustomTables`, or owner/admin) in a household workspace calls `POST /custom-tables/from-source {"kind":"transactions"}`; member A's `isPrivate` rows appear with their real merchant and purpose. Even without a table: `source-preview` with `filters.ids=[<A's private tx id>]` returns the plaintext (ids of private rows are visible in every list, only their text is masked).

Fix: resolve the caller's member id in `CustomTablesService` (it already has `workspaceMemberRepository`) and pass it to `fetchRows`; in `TransactionsSource` either skip `isPrivate` rows that are not the caller's or map them through `redactPrivate` before building `values`. Same for `readRecord` in write-back (currently a write-back on a private row of another member would also read it back in clear).

Existing test: `@tests/e2e/transaction-privacy.e2e-spec.ts` covers statements/storage details, not custom-tables. Not covered.

### 3. MEDIUM — Ex-member uploader keeps full access to workspace files (storage)

Path: every `storage/files/:id/*` route has only `JwtAuthGuard` (no workspace guard); authorisation is `checkFileAccess(userId, statementId, action)`:

```ts
const membership = await this.findMembership(statement.workspaceId, userId);
if (statement.userId === userId) {
  if (membership) { …toggle checks… }
  return;                          // ← no membership: unconditional allow
}
```

When the uploader is no longer a member of the file's workspace, `membership` is null and the branch returns without any check, for `view`, `download`, `edit` (move, trash, restore, permanent delete, category) and `share` (create public links, grant permissions, delete links). A member who *is* still there is restricted by toggles; one who was removed is not.

Exploit: user X uploads a statement in workspace W, is later removed from W. X calls `GET /storage/files/<id>/download` (works, no header needed), `POST /storage/files/<id>/share` → public link to the bank statement, `DELETE /storage/files/<id>/trash` after `POST …/trash` → permanent removal. The statement id is known to X from before, and the file list in `GET /storage/files` is scoped by header workspace so X cannot enumerate new ones, but the old ids suffice.

Fix: treat `statement.userId === userId` as a tie-break only *inside* a membership: `if (!membership) → fall through to FilePermission check` (and FilePermission rows should be deleted/ignored when the grantee's membership is gone — see finding 8).

Existing test: `@tests/e2e/workspace-isolation.e2e-spec.ts:363-368` checks a non-member *other* user gets 403, not a removed uploader. `storage.service.spec.ts` has no case. Not covered.

### 4. MEDIUM — Storage CSV export leaks private rows

Path: `GET /storage/files/:id/transactions/export` → `exportTransactionsCsv(statementId, userId)` → `checkFileAccess(view)` (any member) → `transactionRepository.find({ where: { statementId } })` → CSV with `counterpartyName`, `counterpartyBin`, `documentNumber`, `paymentPurpose`. No `redactPrivateRows`, while `getFileDetails` (same file, same role) redacts.

Exploit: viewer-role member downloads the CSV of a shared statement and reads the owner's private rows.

Fix: `redactPrivateRows(transactions, membership?.id ?? null)` as in `getFileDetails`.
Existing test: none (privacy e2e checks `/storage/files/:id` only).

### 5. MEDIUM — `bulkDelete` hard-deletes, bypassing trash/tax lock

Path: `POST /storage/files/bulk/delete` → `bulkDelete` → `checkFileAccess(edit)` per statement → `this.statementRepository.delete(uniqueIds)`. `statementsService.remove` (used by every other delete path, incl. the trash scheduler) is `moveToTrash` with `ensureCanModify`; `reprocess` guards with `assertNoTaxLockedTransactions`. The bulk path skips all of that: no trash, no audit, no disk cleanup, cascade-deletes `transactions` rows even if `taxLocked`. In-workspace integrity, not isolation (ids are access-checked). Fix: route through `statementsService.remove`/`moveToTrash` like `bulkDeleteFromTrash` does.
Existing test: none.

### 6. LOW — CSV injection via column/summary titles in table export

`exportRows` neutralises cell values (`exportCellValue` → `neutralizeSpreadsheetFormulaCell`) but the header row is `columns.map(col => col.title || col.key)` and summary rows write `item.title` raw; for `format=csv` `sheet_to_csv` emits them verbatim. Column titles are editor input (`PATCH /custom-tables/:id/columns/:columnId`), so an editor can plant `=HYPERLINK(...)`/`=cmd|...` for whoever opens the CSV (including the hourly scheduled export file). XLSX output is unaffected (`t:'s'`). Fix: neutralise headers and summary titles too.

### 7. LOW — Share tokens listed to viewers

`GET /custom-tables/:id/shares` (WorkspaceContextGuard only, no edit check) returns `token` for every share. A viewer cannot mint a link but gets the live one and can hand it out; revocation is editor-only. Fix: omit `token` from the list (the create response already returns it once) or require `canEditCustomTables`.

### 8. LOW — Dangling storage grants/links

- `createSharedLink` refuses a trashed file, but trashing later does not revoke links; `accessSharedLink`/`getSharedDownloadStream` do not check `deletedAt`, and `getSharedLinks` keeps listing them. (CONFIRMED by code.)
- `FilePermission` is granted only to current members (`grantPermission` checks `workspace_members`), but `checkFileAccess` falls back to the FilePermission row for a non-member, so a grantee removed from the workspace keeps view/download (and edit if EDITOR) until the row expires. (LIKELY — no cleanup on member removal found in this module; member-removal code is in another group.)

### 9. LOW — Notes on private transactions

`requireTarget` only checks `{ id, workspaceId }`. Private rows show their id/date/amount to all members, so anyone can `GET /notes?entityType=transaction&entityId=<private id>` and read the owner's notes (which typically say what the row was), or post onto it. Fix: for `TRANSACTION`, load `isPrivate/ownerMemberId` and apply `canReadPrivate` with the caller's member id.

### 10. LOW — data-entry "hide base tab" deletes shared data

`DELETE /data-entry/base-tabs/:type` stores a per-user hidden flag (`users.dataEntryHiddenBaseTabs`) and then `dataEntryRepository.delete({ workspaceId, type, customTabId: IsNull() })` — one member's UI preference wipes every member's entries of that type. Gated by `canEditDataEntry`, so not an escalation, but a destructive side effect hidden behind a "hide" verb.

### 11. LOW — Public icon upload without permission/quota

`POST /data-entry/custom-fields/icon` → multer disk storage into `uploads/custom-field-icons` (served statically at `/uploads/custom-field-icons`, no auth). Any workspace member incl. viewer; MIME from the client's `Content-Type` part, extension derived from it (`sanitizePublicUploadFilename`), name is a uuid (no traversal), 1.5 MB cap, no count/quota, no magic-byte check, orphan files never cleaned. Content is served as image/* by extension so stored-XSS is not reachable; only disk-fill abuse.

### 12. LOW — vendor-icons without throttle

Authenticated-only, fixed upstream host, domain regex + `isIP` guard, raster-only content types, 64 KB cap, negative cache — SSRF is closed. But `@SkipThrottle()` plus a per-domain cache key means a logged-in user can issue unlimited distinct-domain requests, each a 3 s upstream fetch (DuckDuckGo abuse / outbound bandwidth). Fix: a dedicated higher throttle instead of none.

## Per-module verdicts

- **custom-tables** — Isolation clean: every route under `JwtAuthGuard+WorkspaceContextGuard` (convert-to-statement under `@WorkspaceAuth`), every service entry point starts with `requireTable(workspaceId, tableId)` (QueryBuilder, `workspaceId` bound), children (columns/rows/styles/comments/shares/schedules) then queried by `tableId`/`workspaceId`; every mutating method calls `ensureCanEdit(...'canEditCustomTables')` (viewer/accountant blocked; `classifyPaidStatus` and reads are the only unchecked ones and are read-only); relation targets re-checked via `requireTable`; filters/sort/aggregate/group/duplicate column names are validated against the table's column keys and bound as parameters (no SQL injection); categoryId/customTabId resolved with workspace. Formula engine is a hand-written tokenizer/parser (no eval/Function/vm, 500-char cap, uppercased identifiers so `constructor`/`__proto__` cannot reach `FUNCTIONS`, no regex over user input beyond anchored literals → no ReDoS, unknown-field refs rejected at save). Public share: 256-bit `randomBytes` token, lookup by token only, status+expiry enforced, 30/min throttle, read-only, returns `data` without row ids. Recalc processor: payload `{tableId, workspaceId}` created only after `requireTable`; recalc touches rows by `tableId`. Write-back: permission via `workspaceRoleAllows(writer.permission)`, records re-read through the workspace-scoped source adapters, domain services called with `workspaceId`. Holes: #1 (HIGH path traversal in scheduled export), #2 (private rows copied), #6, #7.
- **data-entry** — clean on isolation: all routes `JwtAuthGuard+WorkspaceContextGuard`, every query bound to the header workspace, `customTabId` resolved with workspace, writes gated by `canEditDataEntry`. Notes: #10, #11.
- **notes** — clean on isolation: all routes `@WorkspaceAuth(STATEMENT_VIEW)`, target existence checked with `{ id, workspaceId }` for all six entity types, notes read/written with `workspaceId`, mentions restricted to members, delete = author or owner/admin, `countOpenByEntity` column comes from an enum map. Note: #9 (private-transaction notes).
- **storage** — Mostly clean: file routes are user-scoped by design and anchor on the *file's* workspace membership; folders scoped with `IsNull()` owner handling; tags/views by header workspace; `updateFileTags`/`moveFileToFolder`/`updateFileCategory` resolve body ids in the statement's workspace; grants restricted to members of the file's workspace; share token 256-bit, bcrypt password in a header, status/expiry/allowAnonymous enforced, 30/min throttle, private rows redacted on the public path; file streams come from DB `filePath` through `FileStorageService.resolveFilePath` (no client path). Trash scheduler iterates expired statements with their own `workspaceId`/`userId`. Holes: #3 (MEDIUM ex-member uploader), #4 (MEDIUM CSV export leaks private rows), #5 (MEDIUM bulkDelete bypass), #8.
- **vendor-icons** — clean (auth-only, validated domain used as path segment on a fixed host, raster-only, size-capped, hashed cache key). Note #12.
- **maps** — clean: auth-only, style id must match the tile server's advertised list, z/x/y integer-validated against the zoom grid, upstream host is operator config, no client path reaches the URL unvalidated, no traversal, cache key constant.
- **geocoding** — clean: no controller (used only by receipts services), upstream host operator config, query via `URLSearchParams`, coordinates validated, cache keys hashed, never logs addresses.

## Not checked / uncertainty

- Whether `WorkspaceMember` rows and `FilePermission`/`custom_table_shares` are cleaned when a member is removed (lives in the workspaces module, another group) — finding 8b is marked LIKELY for that reason.
- `getWith` (common/effect/http-json) redirect behaviour for the vendor-icon fetch was not read; even if it follows redirects the response is still raster-only and 64 KB-capped, so at most a bandwidth note.
- VERSION-workspace handling for storage routes that have no `WorkspaceContextGuard` (how `@AllowInVersion` is enforced there) was not traced; `bulkDownload` is marked read-only but `trash/restore/share` on a file inside a version snapshot may be writable — depends on the global guard, out of this group's files.
- `StorageFileDetails`/`StorageFileList` response contracts were not opened; the service returns `statement.user`, `permissions[].user/grantedBy` entities and relies on `SchemaResponse`/`HideInternalColumnsInterceptor` to strip them.
- The HIGH finding was verified with a `path.join` reproduction only, not by running the scheduler against a database.
