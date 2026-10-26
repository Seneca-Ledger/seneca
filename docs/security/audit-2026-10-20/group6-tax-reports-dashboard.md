# Group 6 — tax, tax-pack, tax-reminders, income-tax, reference-data, reports, dashboard, insights, forecast, net-worth

Audited at origin/main 43af3ca7 (`scratchpad/audit`). Every controller + service + scheduler in the assigned modules was read in full; findings below are traced route → service → query. Paths are relative to `backend/src/`.

## Findings

| Severity | Confidence | Module | file:line | Title |
|---|---|---|---|---|
| CRITICAL | CONFIRMED | reports | `modules/reports/reports.service.ts:2874-2883`, `report-document.util.ts:286-287`, `reports.service.ts:2948-2950` | Generated template reports share one file path across all workspaces → history download serves another tenant's report |
| MEDIUM | CONFIRMED | reports / dashboard / forecast | `modules/reports/reports.service.ts:1769-1795, 3341-3380, 1283-1290`, `cash-flow-map.service.ts:165-217`, `spend-flow.service.ts:58-69`, `dashboard/dashboard.service.ts:627-634, 769, 1628-1635`, `forecast/forecast.service.ts:316-333, 401` | Other members' private rows (`is_private`) are exported/listed with merchant, purpose, comments — no `canReadPrivate` in any report or dashboard path |
| MEDIUM | CONFIRMED | tax / income-tax | `modules/tax/tax-returns.service.ts:124-133, 188-198`, `tax/ustva/ustva.service.ts:614-649`, `income-tax/income-tax-draft.service.ts:457-471` | VAT return lines / USt-VA / income-tax contributions include counterparty of other members' private rows (and freeze them into the filed snapshot) |
| MEDIUM | CONFIRMED | reports | `modules/reports/report-schedules.service.ts:234-283` | Scheduled e-mail reports keep running after the creating member is removed from the workspace (no membership/permission check in `runDue`, no cleanup on member removal) |
| LOW | CONFIRMED | tax | `modules/tax/tax-returns.controller.ts:38-46, 62-70, 103-123`, `tax-returns.service.ts:129, 244-260` | `periodStart/periodEnd` on `GET /tax/returns/{period,ustva,export}` are raw strings (no schema); invalid input → `Between(Invalid Date)` → 500; `GET period` persists a draft row on read under CATEGORY_VIEW |
| LOW | CONFIRMED | tax / reference-data | `modules/tax/workspace-tax.controller.ts:170-174`, `reference-data/tedb-vat-rates.service.ts:520-577` | `POST /tax/settings/official-rates/refresh` lets any settings manager force an outbound TEDB SOAP call bypassing the 6 h cache (egress amplification; fixed host, no SSRF) |
| LOW | CONFIRMED | insights | `modules/insights/insights.service.ts:328-346, 388` | Insight upsert matches by `(userId, deduplicationKey)` without `workspaceId`; an existing insight row from the user's other workspace is re-pointed (`existing.workspaceId = workspaceId`) — rows migrate between the same user's workspaces |
| LOW | LIKELY | income-tax | `modules/income-tax/nbp-rates.service.ts:57`, `bdi-rates.service.ts:22,125` | `transaction.currency` is interpolated into the NBP/BdI URL path without a `^[A-Z]{3}$` check (fixed host; only path manipulation on the public API) |

### 1. CRITICAL — shared report file path across tenants (reports)

Path: `POST /reports/generate` (REPORT_EXPORT) → `ReportsService.generateFromTemplate` → `writeReportFile(doc, format, baseName, uploads/reports)` / `writeBalanceSheetFile`; also `ReportSchedulesService.runSchedule` (cron, every hour) → same method. Then `GET /reports/history/:reportId/download` → `downloadHistoryReport` → `fs.createReadStream(report.filePath)`.

```ts
// reports.service.ts:2874
const baseName = `${dto.templateId}-${dto.dateFrom}-${dto.dateTo}`;
// report-document.util.ts:286
const fileName = `${baseName}.${EXTENSIONS[format]}`;
const filePath = path.join(targetDir, fileName);   // targetDir = uploads/reports (global)
...
fs.writeFileSync(filePath, ...)                    // overwrites
// reports.service.ts:2885 history row stores that filePath per workspace
```

The file name carries no workspace id, user id or timestamp. `uploads/reports` is one directory for the whole instance. Workspace B generating `monthly-summary` for `2026-09-01..2026-09-30` overwrites the file that workspace A's `report_history` row points at. `downloadHistoryReport` only checks the DB row (`{ id, workspaceId }`) and then streams whatever is at that path.

Exploit (attacker-driven): member of workspace B with REPORT_EXPORT calls `POST /reports/generate {templateId:'transaction-register', dateFrom:'2026-09-01', dateTo:'2026-09-30', format:'csv'}` — B now has a history row pointing at `uploads/reports/transaction-register-2026-09-01-2026-09-30.csv`. Whenever any other workspace A (or A's hourly schedule, which uses the same last-completed-month range for everyone) generates the same template/range/format, that file now holds A's full transaction register (counterparties, amounts, comments, tags). B calls `GET /reports/history/<its own id>/download` and receives A's data. Monthly schedules make the collision deterministic: every workspace with a monthly `pnl` schedule writes `pnl-<prev month>` within the same hourly sweep, and the e-mail attachment of a *later* schedule run is read after a possibly concurrent HTTP generate as well. Also an integrity issue: A's history now shows B's figures. Formats collide independently (`.pdf`/`.xlsx`/`.csv`).

Verified: naming traced, `writeFileSync` overwrite, no workspace segment in `resolveReportsDir()`, download trusts stored path. `uploads/reports` is NOT in `resolveStaticAssetMounts` (not publicly served), so the leak is through the authenticated history download / e-mail only.

Fix: write under `uploads/reports/<workspaceId>/<uuid>-<baseName>.<ext>` (or at least prefix a `randomUUID()`), and in `downloadHistoryReport` assert `report.filePath` is inside that workspace's directory. Migrate existing rows or treat pre-fix rows as unavailable.

Existing test: `@tests/unit/modules/reports/reports.service.spec.ts` 'generateFromTemplate' / 'downloadHistoryReport' exist but assert nothing about per-tenant paths. No e2e.

### 2. MEDIUM — private rows leak into reports / dashboard / forecast

Model (entity `transaction.entity.ts:216-227`, `common/utils/transaction-privacy.util.ts`): `isPrivate` rows keep date/amount visible to the household but merchant/purpose/document number/comments must be redacted for anyone but `ownerMemberId`. `tax-pack` honours this (`canReadPrivate` at `tax-pack.service.ts:382`); nothing else in this group does (grep for `isPrivate|canReadPrivate|redactPrivate` across reports/dashboard/forecast/insights/net-worth = 0 hits).

Concrete outputs that name the merchant of another member's private row to any member with REPORT_VIEW / any workspace member (dashboard has only WorkspaceContextGuard, so viewers too):
- `GET /dashboard` → `getRecentTransactions` (`dashboard.service.ts:769` `t.counterpartyName AS description`), `getTopMerchants` (627-634), income sources in trends (1628-1635).
- `GET /reports/daily|monthly`, `POST /reports/custom|export` → transactions listed/grouped by counterparty.
- `POST /reports/workspace-export` → `mapWorkspaceTransactionRows` (1769-1795): counterpartyName, counterpartyBin, paymentPurpose, documentNumber, comments for every counted row.
- `POST /reports/generate|preview` template `transaction-register` (3341-3380): counterparty + comment + tags; CSV/XLSX/PDF, retained in history and e-mailed by schedules.
- `GET /reports/cash-flow-map` (`cash-flow-map.service.ts:165,217`), `GET /reports/spend-flow` (`spend-flow.service.ts:58-69` merchant nodes).
- `GET /forecast` → `incomeByParty/expenseByParty` from `counterpartyName` (316-333, 401).
- Insights: `stoic-behavior.service.ts` merchantRows feed "top merchant" advice text.

Fix: apply `redactPrivateRows(rows, viewerMemberId)` (or SQL `CASE WHEN is_private AND owner_member_id <> :me THEN '—' END`) in every path above; controllers already receive `@WorkspaceMemberId()` in some routes — pass it to the rest. Existing test: `@tests/e2e/transaction-privacy.e2e-spec.ts` covers only `/reports/top-categories`.

### 3. MEDIUM — private rows in tax returns / USt-VA / income-tax drafts

`TaxReturnsService.computeTotals` (`tax-returns.service.ts:124-133`) selects all counted rows with tax and emits `lines[].counterparty = transaction.counterpartyName` (188-198). These lines are returned by `GET /tax/returns/preview|period` (CATEGORY_VIEW = every member incl. viewer/accountant), exported via `GET /tax/returns/export` (CSV/XLSX/PDF) and frozen into `tax_returns.snapshot` on filing. `UstvaService.rowsOf` (614-649) emits `payeeName`; `IncomeTaxDraftService.compute` (457-471) emits `contributions[].counterparty` on `GET /income-tax/returns/:year` and the export. None consult `isPrivate/ownerMemberId`. Whether a *tax* return must include a household member's private row is a product decision (the amount must count), but the counterparty text should be redacted for non-owners as `tax-pack` already does. Fix: redact `counterparty` with `canReadPrivate(row, viewerMemberId)` (controllers need `@WorkspaceMemberId()`); for the filed snapshot either store the redacted label or redact on read. No tests.

### 4. MEDIUM — report schedules outlive membership

`POST /reports/schedules` (REPORT_EXPORT) stores `recipients` (≤20 e-mails, any address) and `userId`. `runDue` (`report-schedules.service.ts:234-258`) loads `{ isActive, nextRunAt <= now, workspace.kind standard }` and mails `generateFromTemplate(schedule.workspaceId, …)` to the recipients using the creator's SMTP settings (`getSmtpSettings(user)`). Nothing checks that `schedule.userId` is still a member of `schedule.workspaceId` or still holds REPORT_EXPORT, and no module outside `reports/` references `ReportSchedule` (grep), so removing a member / demoting them to viewer / the member leaving does not stop their schedules. Exploit: an accountant/member creates a daily `transaction-register` schedule to a personal address; after being removed they keep receiving the workspace's full ledger every morning. Fix: in `runDue` skip+deactivate schedules whose `userId` is no longer a member with REPORT_EXPORT; delete schedules in the member-removal path. Not tested.

### 5. LOW — unvalidated period strings on tax returns

`GET /tax/returns/period|ustva|export` read `periodStart/periodEnd` with bare `@Query()` (only `preview` uses `SchemaQuery(TaxReturnPeriodQuery)`). `computeTotals` does `Between(new Date(periodStart), new Date(periodEnd))` → invalid date → DB error (500, stack in logs); `getForPeriod` then `save()`s a draft row with the raw strings into `date` columns. `getForPeriod` also writes (`returnRepository.save(draft)`) on a GET with CATEGORY_VIEW — a viewer/accountant creates/rewrites draft rows. `ustva.service.ts:569` validates the format itself. Fix: use `TaxReturnPeriodQuery` on all three routes; compute the draft without persisting on read.

### 6. LOW — forced TEDB refresh

`POST /tax/settings/official-rates/refresh` (WORKSPACE_SETTINGS_MANAGE) → `tedbService.snapshot(code, { force: true })` → SOAP POST to `ec.europa.eu` every call, 60 s timeout, result upserted into the global `reference_data` table shared by all workspaces. URL and member-state code are fixed/validated (`^[A-Z]{2}$`), response parsed by regex (no XML parser → no XXE), so this is egress amplification only (ThrottlerGuard is the sole limit). Holidays/VIES fetchers likewise use fixed URLs and validated inputs. Reference refresh is per-workspace, not instance-admin-only, but carries no tenant data.

### 7. LOW — insight rows cross the same user's workspaces

`upsertCandidate` finds an active row by `{ userId, deduplicationKey, isDismissed:false }` and `findSnoozed` by `{ userId, deduplicationKey, isDismissed:true }` — no `workspaceId` — then sets `existing.workspaceId = workspaceId` (388). Dedup keys are type-based (e.g. `uncategorized_transactions`), so refreshing in workspace B steals/overwrites the row created in workspace A; a dismissal in A also snoozes it in B. Same user only, no cross-user exposure. `list/dismiss/dismissAll` are correctly scoped by both ids. Fix: add `workspaceId` to both lookups (and to the unique index).

### 8. LOW — currency code in external rate URL

`nbp-rates.service.ts:57`: `${NBP_API}/${code.toLowerCase()}/${start}/${end}/` and BdI similar, with `code = transaction.currency`. If a transaction currency were stored unvalidated (e.g. `../x`), the request path changes on the fixed host. Not SSRF (host fixed); hypothesis depends on currency validation in the transactions module (not in this group).

## Per-module verdicts

- **tax** (tax-rules, tax-rates, tax-returns, jurisdictions, workspace-tax + assignment/adoption/reserve/threshold/official-rates/ustva/subscriber): all mutating routes under `WorkspaceAuth(WORKSPACE_SETTINGS_MANAGE|CATEGORY_*)`; every repository call scoped by `workspaceId` (`WorkspaceCrudBaseService.findOne` includes it; category/tax-rate ids from body re-checked with `{ id, workspaceId }`; `explicitTaxRateId` resolved via scoped `findOne`); `whereInIds` on filing uses ids already loaded per workspace; jurisdictions are read-only global reference (JWT only, GET only, no mutation path). CSV export goes through `toCsv` (formula-neutralised); XLSX via `json_to_sheet` (strings). Holes: #3 private counterparties in return lines/snapshot, #5 raw period strings + write-on-GET, #6 forced refresh. Crons (`checkAll`) iterate standard workspaces explicitly.
- **tax-pack**: clean — REPORT_EXPORT+TRANSACTION_VIEW+STATEMENT_VIEW; rows scoped + `canReadPrivate`; attachments/receipts/statements loaded with `workspaceId`; receipt paths checked to be under uploads dir; archive entry names via `sanitizeArchiveEntryName` (basename only); range capped at 3 years; CSV neutralised.
- **tax-reminders**: clean — GET REPORT_VIEW, PUT WORKSPACE_SETTINGS_MANAGE with schema body; settings rows keyed by `workspaceId`; cron iterates standard workspaces with a jurisdiction; delivery goes through `tax.deadline.upcoming` event (notifications module decides recipients).
- **income-tax**: clean apart from #3/#8 — reads REPORT_VIEW, writes WORKSPACE_SETTINGS_MANAGE; mapping `categoryId`s validated with `count({ id In, workspaceId })`; line keys validated against the pack; profile `details` is an unbounded `Record<string, unknown>` jsonb (1 MB body limit) read only by typed rule-pack accessors; disclaimer is per-user; finalize race handled via unique index; exports neutralised; completeness queries scoped.
- **reference-data**: clean — fixed official URLs (TEDB/VIES/OpenHolidays), inputs validated (`^[A-Z]{2}$`, VAT number regex + `encodeURIComponent`), timeouts, regex XML parsing (no XXE), `REFERENCE_DATA_OFFLINE` kill switch; global `reference_data` table holds no tenant data. Only #6 (per-workspace forced refresh).
- **reports**: #1 CRITICAL shared file path; #2 private rows; #4 orphaned schedules. Otherwise: all routes `WorkspaceAuth(REPORT_VIEW|REPORT_EXPORT)`; history list/download and schedule PATCH/DELETE scoped by `{ id, workspaceId }`; `templateId` validated against `TEMPLATE_NAMES` before it reaches the file name; dates are `IsoDateString`; wallet/category id filters only narrow a workspace-scoped query; no string-interpolated SQL from client input (`getTransactionGroupFormat` is a constant); CSV/XLSX exports neutralise formulas (`neutralize`, `toCsv`, `neutralizeSpreadsheetFormulaCell`); cash-flow CSV filename built from validated ISO dates; scheduled runs use `schedule.workspaceId` (not a user's home workspace) and `STANDARD_WORKSPACE` filter; recipients schema-validated e-mails ≤20.
- **dashboard** (incl. setup-progress): read-only (all GET), guards JwtAuthGuard+WorkspaceContextGuard, no mutating route; all queries scoped; `user.id` used only for member role / Telegram connection lookups; `days/year/month` validated. Hole: #2 (private rows in recent transactions / top merchants / income sources, visible to viewers).
- **insights**: GET/POST all per `(userId, workspaceId)`; dismiss/dismiss-all update with both ids; analyzers scope by `workspaceId`; `refresh` only rebuilds the caller's own rows. Hole: #7 (dedup lookup without workspace), and merchant-named advice shares #2.
- **forecast**: clean — single GET under REPORT_VIEW, schema query, every query `workspaceId`-scoped, sub-services called with `workspaceId`. Shares #2 (party names).
- **net-worth**: clean — single GET under REPORT_VIEW, schema query (`range` literal, `denominate` via `toEnum`), all queries scoped; aggregates only. Note: GET triggers `seedDefaultAccounts(workspaceId)` (idempotent write by a viewer).

## Not checked / uncertainty

- `reports.service.ts` custom-tables report paths (565-1260) were skimmed for scoping only (`workspaceId` passed to the custom-tables loader); formula-engine content is the custom-tables module's domain.
- `report-template.translations.ts`, `insight-translations.ts`, `stoic-texts/*`, `quotes/texts/*`, `jurisdictions.seed.ts`, `vat-deadlines.ts`, `filing-info.ts`, rule packs: static data, not read line by line.
- Whether `transaction.currency` is constrained to 3 letters (finding #8) depends on the transactions module.
- Notification fan-out for `tax.deadline.*` / `tax.threshold.reached` / `tax.rates.official_changed` events (who receives them) lives in the notifications module, outside this group.
- Finding #1 was not reproduced at runtime (read-only audit); the overwrite is deterministic from the code.
