# Group 7 — ledger, investments (+metals), crypto, wallets, exchange-rates, bank-sync, backups, audit

Commit audited: origin/main 43af3ca7 (worktree `scratchpad/audit`). All paths below are relative to `backend/src`.

## Findings

| Sev | Conf | Module | file:line | Title |
|---|---|---|---|---|
| CRITICAL | CONFIRMED | backups | modules/backups/backup-restore.service.ts:310-359 | Restore inserts attacker-crafted `shared_links` / `file_permissions` rows pointing at another tenant's statement → public/authenticated read of a victim's statement file and rows |
| HIGH | CONFIRMED | backups | modules/backups/backup-restore.service.ts:310-330, 372 | Restore accepts ANY entity table, including global ones (`exchange_rates`, `instance_settings`, `parsing_rules`, `tax_jurisdictions`, `tax_jurisdiction_rates`, `reference_data`, `workspaces`) → instance-wide config / rate poisoning by any user |
| HIGH | CONFIRMED | backups | modules/backups/backup-restore.service.ts:353-354 | Restore keeps every unknown `*Id` foreign key verbatim → cross-tenant references (category/statement/wallet/payee/invoice/entry/table ids of other workspaces) and data injection into other tenants' parent rows via child tables without `workspace_id` (`invoice_line_items`, `journal_lines`, `custom_table_rows`, `file_versions`, `payable_payments`) |
| MEDIUM | CONFIRMED | investments | modules/investments/investments.controller.ts:28-89 | Every mutating investments route is gated by `REPORT_VIEW` (a read permission every viewer/accountant holds): viewers create/delete accounts & holdings and rewrite balance snapshots |
| MEDIUM | CONFIRMED | investments (metals) | modules/investments/metals.controller.ts:63-180 | Same: add/update/delete/sell lots, photo upload, settings, refresh-prices all under `REPORT_VIEW` → viewers write |
| MEDIUM | CONFIRMED | investments (metals) | modules/investments/metals.service.ts:213 | `addLot` stores `dto.ownerUserId` unvalidated (updateLot validates membership, addLot does not) → cross-tenant user reference on `investment_holdings.owner_user_id` (and copied to `metal_sales`) |
| MEDIUM | LIKELY | backups | modules/backups/backup-archive.service.ts:119-158 | Nested adm-zip + JSON.parse of a 200 MB upload fully in memory with no decompressed-size cap → zip-bomb DoS by any authenticated user (no workspace, no rate limit on `/backups/import/preview`) |
| LOW | CONFIRMED | audit | modules/audit/audit.service.ts:184 | `actorLabel` filter → `ILIKE %…%` without escaping `%`/`_` |
| LOW | CONFIRMED | audit | modules/audit/audit.service.ts:293 | Rollback skips the workspace check for events with `workspaceId = null`; instance-admin only, by-id writes |
| LOW | CONFIRMED | investments | modules/investments/stock-price.service.ts:614 | Holding `symbol` (1–32 chars, no pattern) concatenated unencoded into the Stooq query string (`&`, `#`, `?` reach the URL); host fixed, so query injection against Stooq only |
| LOW | CONFIRMED | exchange-rates | modules/exchange-rates/exchange-rates.service.ts:745,772 | `from`/`to` (3–10 chars, no pattern) interpolated into provider URL paths (`/latest/${base}`, `/currencies/${from}.json`); host fixed, path-injection against providers only; also unbounded `bulkConvert` items each hitting the network |
| LOW | CONFIRMED | bank-sync | modules/bank-sync/bank-sync.controller.ts:17-22 | `GET integrations/simplefin/status` has only `WorkspaceContextGuard` (no permission): any member incl. viewers sees account ids/names/balances/lastError |

### 1. CRITICAL — crafted backup restores `shared_links` / `file_permissions` onto a victim's statement

Path: `POST /backups/import/preview` (JwtAuthGuard only, no workspace) → `BackupImportService.preview` → `POST /backups/imports/:id/restore` → `BackupRestoreService.restore` → `restoreOpened` → `sortedCollections` (filters only `workspace`, REMOVED_COLLECTIONS, UNRESTORABLE_COLLECTIONS) → `prepareCollections` matches ANY `dataSource.entityMetadatas` table → `mapRecord` → `manager.getRepository(...).insert(values)`.

The archive is craftable by anyone: `BackupArchiveService.open` derives the data key from the **user-supplied** password through the scrypt envelope stored **inside** the manifest (no server secret involved; `create()` with `password` is the mirror). So any registered user builds an archive whose `data/shared_links.json` contains `{ "statementId": "<victim statement uuid>", "userId": "x", "token": "attackertoken…", "permission": "edit", "status": "active", "allowAnonymous": true }`.

`mapRecord`: `statementId` ends in `Id`, not in idMap → kept verbatim (line 353); `userId` → restorer (USER_REFERENCE_PROPERTIES); `token` is NOT in PUBLIC_TOKEN_PROPERTIES (only `shareToken` is) → kept. `shared_links` has no `workspaceId` column, so nothing re-scopes it. FK `statement_id → statements` is satisfied by the victim's row.

Exploit: attacker (any account, any workspace) restores the archive, then anyone opens `GET /api/v1/storage/shared/attackertoken` (`@Public()`, `storage.controller.ts:554/572`) → `StorageService.accessSharedLink` (`storage.service.ts:1140`) finds the link by token only, returns `link.statement` (victim's statement metadata) and, because permission ≠ view, all its transactions; `/download` streams the victim's file. Same with `data/file_permissions.json` `{ statementId: victim, userId: x, permissionType: 'edit', isActive: true, grantedById: x }` → `getUserPermissionForStatement(userId, statementId)` (`storage.service.ts:1413`) grants the attacker the victim's statement in their own storage listing (`storage.service.ts:134`) and edit/download rights.

Victim statement ids are UUIDs (need to be known/guessed), but ids leak through many surfaces (shared links, audit, invoices, PEPPOL, URLs in e-mail); the restore itself does not need the victim's cooperation.

Evidence (`backup-restore.service.ts`):
```ts
} else if (property.endsWith('Id') && typeof source[property] === 'string') {
  record[property] = idMap.get(source[property] as string) || source[property];
```
```ts
const metadata = this.dataSource.entityMetadatas.find(item => item.tableName === tableName);
if (!metadata) throw new BadRequestException(`Backup contains unsupported collection: ${tableName}`);
```
Fix: restore only an explicit allow-list of workspace-scoped tables (what `BackupDataService.collect` emits, minus EXCLUDED_TABLES); drop any `*Id` value not found in `idMap` (null it or reject the archive) except for known global references (`taxJurisdictionId`, `jurisdictionId`); null `token`/`password` style columns on restore. Also strip `encryptedSecrets`/`keyHash`-like columns on restore.
Existing test: `@tests/unit/modules/backups/backup-restore.service.spec.ts` covers remapping only; no e2e for `/backups/*`. No.

### 2. HIGH — restore writes global (non-workspace) tables: rate/config poisoning for every tenant

Same path. `BackupDataService.collect` only exports `workspaceId` tables, but `restoreOpened` never checks that. Entities without `workspaceId` that are accepted: `exchange_rates`, `instance_settings`, `parsing_rules`, `reference_data`, `tax_jurisdictions`, `tax_jurisdiction_rates`, `workspaces`, `auth_sessions`, `integration_tokens`, `push_subscriptions`, `telegram_reports`, `email_change_tokens`, `password_reset_tokens`, `webhook_deliveries`, `notification_preferences`, `income_tax_disclaimer_acceptances`, `drive/dropbox/gmail_settings`, `open_protocol_settings` (plus the ones in finding 1).

Exploit: archive with `data/exchange_rates.json` = `[{baseCurrency:'USD', targetCurrency:'EUR', rate: 0.01, rateDate:'2026-10-20', source:'exchangerate-api'}, …next 365 days…]`. `ExchangeRatesService.lookupStoredRate` reads the global `exchange_rates` table **before** any provider call (`exchange-rates.service.ts:321`), so every workspace converting USD→EUR today (dashboards, budgets, tax packs, ledger posting via `rateFor`, net worth, invoices) uses the attacker's rate; the unique index only blocks dates already stored. `instance_settings` (`@Unique(key)`) rows for keys not yet set (e.g. the shared Telegram bot token/`encryptedSecrets` — `updatedByUserId` is mapped to the restorer) are inserted instance-wide; `parsing_rules` (global statement parsing rules, `isActive`) and `tax_jurisdiction_rates` (unique per jurisdiction/code/validFrom — new `validFrom` dates win) are likewise injectable; `workspaces` rows create extra workspaces owned by the restorer (harmless).
Fix: as in #1 (allow-list of workspace-scoped tables; refuse archives containing anything else).
Existing test: none.

### 3. HIGH — restore keeps foreign keys of other tenants (cross-tenant references + injection)

Same path, line 353. For every workspace-scoped row, any `*Id` column whose value is not an id inside the archive is written as-is: `transactions.categoryId/statementId/walletId/payeeId/receiptId/goalId/budgetId/investmentAccountId/cryptoWalletId/ownerMemberId/transferPairId`, `receipts.transactionId`, `payables.linkedTransactionId/clientId`, `invoices.clientId`, `categories.parentId/ledgerAccountId`, `journal_lines.accountId`, … The rows land in the attacker's new workspace but reference the victim's rows (A→B references that the previous sweeps spent effort removing). Consequences: any listing that follows a relation (`relations: ['category','wallet','statement']`) renders the victim's names/bank/account-number in the attacker's workspace; `ON DELETE RESTRICT` FKs let the attacker block the victim from deleting their own category/wallet/statement.

Worse, tables without a `workspace_id` of their own are inserted purely by parent id: `invoice_line_items.invoiceId`, `credit_note_line_items.creditNoteId`, `journal_lines.entryId` (DB trigger blocks lines on a booked entry, but a draft entry of the victim accepts them), `custom_table_rows/columns/column_styles.tableId`, `custom_table_cell_styles.rowId`, `file_versions.statementId`, `payable_payments.payableId`, `statement_tags/transaction_tags` → attacker-authored rows appear **inside the victim's** invoice, custom table, statement version history or draft journal entry (`StorageService.accessSharedLink` and the victim's own views select by parent id). `ownerMemberId` → a member of another workspace (`assertOwnerMemberInWorkspace` is bypassed).
Fix: null or reject any `*Id` not resolvable through `idMap` (except whitelisted global references); only restore child tables whose parent id maps.
Existing test: `cross-workspace-references.e2e-spec.ts` covers API bodies, not restore. No.

### 4/5. MEDIUM — viewers/accountants write investments and metals

Path: `POST/PATCH/DELETE /investments/accounts|holdings|refresh-prices` and `POST/PATCH/DELETE /metals/lots|lots/:id/sell|lots/:id/photo|settings|refresh-prices` → `@WorkspaceAuth(Permission.REPORT_VIEW)` → `InvestmentsService`/`MetalsService` → `BalanceService.createCustomAccount/deleteCustomAccount/updateSnapshot` (no permission check of their own). `REPORT_VIEW` ∈ `WORKSPACE_READ_PERMISSIONS` (`common/authz/workspace-permissions.ts:45`) so `workspaceRoleAllows` returns true for VIEWER and ACCOUNTANT.
Exploit: a viewer invited to a workspace `POST /investments/accounts {name:'x'}` / `DELETE /investments/accounts/:id` (deletes holdings, detaches contributions, deletes the balance account) / `PATCH /metals/lots/:id {price: 0}` — net worth, balance sheet and metals book of the workspace change; `writeSnapshot` rewrites `balance_snapshots`. Only `/investments/contributions` uses `TRANSACTION_EDIT`.
Fix: introduce an investment write permission (owner/admin, member toggle) or reuse `WALLET_CREATE/EDIT/DELETE` as the crypto controller does.
Existing test: `investments.e2e-spec.ts`, `metals.e2e-spec.ts` have no viewer/403 case. No.

### 6. MEDIUM — metals `addLot` trusts `ownerUserId`

`metals.service.ts:213` `ownerUserId: dto.ownerUserId ?? userId` with no `requireMemberId` (unlike `updateLot:263`). Any UUID — a user of another tenant — is stored on `investment_holdings.owner_user_id`, copied to `metal_sales.owner_user_id` on sale, and surfaces in per-owner views. Fix: `dto.ownerUserId ? await this.requireMemberId(workspaceId, dto.ownerUserId) : userId`. Test: no.

### 7. MEDIUM (LIKELY) — backup preview/restore zip bomb

`BackupsController` `BACKUP_UPLOAD_OPTIONS` caps the upload at 200 MB (memory storage). `BackupArchiveService.open` then does `new AdmZip(archive)` → `JSON.parse(manifest)` → base64-decodes `payload.ciphertext` (string in JSON) → decrypts → `new AdmZip(payload)` → `getData()` + `JSON.parse` per entry, all in memory, with no decompressed-size or entry-count cap. The outer zip is one JSON file (ratio ~1000:1 for a repetitive payload), the inner zip can be another bomb. Any authenticated user, no workspace, no `@Throttle`. Fix: stream/limit `getData()` sizes, cap manifest size, validate `files[].size` totals, rate-limit the route. Test: no.

### 8–12. LOW
- audit `ILIKE` on `actorLabel` without escaping (`audit.service.ts:184`): `%` matches everything — DoS-ish only.
- audit rollback (`audit.service.ts:293`) tolerates `event.workspaceId === null` from any workspace context; writes are `repository.update(event.entityId, before)` / `save(before)` by id. Instance ADMIN only, so hardening: require `event.workspaceId === workspaceId`.
- Stooq symbol concatenation (`stock-price.service.ts:614`): add `/^[A-Z0-9.^-]+$/` to `UpsertHoldingBody.symbol` and `encodeURIComponent`.
- exchange-rates: add `/^[A-Z]{3}$/`-style pattern to `ExchangeRateQuery.from/to`, `ConvertItemInput.currency`, `BulkConvertBody.targetCurrency`; cap `items` length (each unknown pair/date triggers up to 4 outbound requests).
- bank-sync `status` without a permission (viewer-visible balances) — add `INTEGRATION_VIEW`/`WALLET_VIEW`.

## Per-module verdicts

- **ledger** (accounts, entries, reports, revaluations, settings, sync queue/processor/sweeper): clean. 17 routes, all `@WorkspaceAuth(LEDGER_*)`; every find/update/delete/raw SQL carries `workspace_id` as a bound parameter; body ids (`accountId`, `categoryId`, `branchId`, `parentId`) resolved with `In(ids), workspaceId`; `query.accountId` only narrows an already-scoped EXISTS; processor job payload is just `{workspaceId}` re-validated by `syncWorkspace` (standard kind, ledger enabled); `nextEntryNo`/advisory locks per workspace; no string interpolation except constant SQL helpers (`countedSql`, `notInVersionWorkspace`).
- **investments**: 2 MEDIUM (viewer writes on all mutating routes; `addLot` ownerUserId unvalidated) + 1 LOW (Stooq symbol). Queries themselves are scoped (`requireAccount/requireHolding/requireLot/requireReceiptId` all `{id, workspaceId}`; `linkContribution` scopes both transaction and account). Photo upload: raster MIME only, uuid filename, served without session by design.
- **crypto**: clean. All 15 routes under `WALLET_*`; `getOwnedWallet` scoped; sync/import/holdings/balance queries scoped; addresses validated by strict per-family regex + base58 checksum before storage and only then placed in fixed-host URLs (Blockscout/mempool/TronGrid/Solana RPC/CoinGecko via URLSearchParams or path); icon proxy validates ticker, pins image hosts and content types; cron iterates STANDARD workspaces by wallet row. Note `@Get('icon/:asset')` is JWT-only (no tenant data).
- **wallets**: clean. 5 routes under `WALLET_*`; `WorkspaceCrudBaseService` scopes `findOne/update/remove`; `ownerMemberId` checked via `assertOwnerMemberInWorkspace`; body spread is schema-whitelisted (no `workspaceId/userId` fields).
- **exchange-rates**: clean on tenancy (manual rates live in `workspace_exchange_rates` scoped by workspaceId; the global cache is written only from providers; `setManual` needs `WORKSPACE_SETTINGS_MANAGE`); 1 LOW (currency codes unpatterned into provider URL paths, unbounded bulkConvert). But see backups #2 — the global table is poisonable through restore.
- **bank-sync**: clean apart from the LOW on `status` permission. Claim/access URLs go through `fetchPublicUrl` (DI `BANK_SYNC_FETCH`), https enforced, credential stored with `encryptText`, never returned (`status` exposes config only); `walletId` validated against workspace; cron iterates by `integration.workspaceId` with the connecting user; OFX fed to `StatementsService.create` with escaping.
- **backups**: 1 CRITICAL + 2 HIGH + 1 MEDIUM. Config/runs/download are owner-only (`requireOwner` on `ownerId`) and scoped; local destination path alphabet + root containment checked; collect exports only this workspace's rows and strips `token/secret/passwordHash/encryptedSecrets/accessToken/refreshToken` (note: `keyHash`, `password` (shared_links bcrypt), `encryptedDataKey` are not in the set but the tables holding them are excluded). Restore is the hole: no table allow-list, FK pass-through, tokens not nulled.
- **audit**: clean on scoping (list/entity/batch/one all `AND event.workspaceId = :workspaceId`; `StripKeysInterceptor(ACCOUNT_KEYS)` + hide-internal on output; interceptor's `x-workspace-id` header fallback is only reachable from routes that all carry a workspace guard today). Rollback is instance-ADMIN-only with the LOW above.

## Not checked / uncertainty

- `StorageService` was only read far enough to confirm the shared-link and file-permission consumers for finding #1; the rest of storage is another group's.
- Whether specific victim-side listings (`GET /statements/:id/transactions`, invoice detail, custom table rows) select children purely by parent id was inferred from `accessSharedLink` and the restore order comments, not traced for every table; the injection half of #3 is LIKELY, the reference half CONFIRMED.
- Webhook endpoints restored via backup bypass the create-time egress check (`webhook_endpoints` has workspaceId, restorable); whether delivery re-validates through `fetchPublicUrl` was not checked (webhooks module not mine).
- Zip-bomb (#7) reasoned from adm-zip semantics, not executed.
- `custom_table_*` and `file_versions` entity columns were not opened; their names come from the entity table listing.
