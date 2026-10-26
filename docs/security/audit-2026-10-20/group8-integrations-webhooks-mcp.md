# Group 8 — integrations, webhooks, MCP, push, notifications, mailer

Audited at origin/main 43af3ca7 (worktree `scratchpad/audit`). All paths below are `backend/src/...` unless noted. Read in full: gmail (controller, all services, processor, scheduler, webhook guard), google-drive, dropbox, `common/services/oauth-integration-base.service.ts`, `common/services/cloud-storage-base.service.ts`, telegram (all files except the translations table), webhooks (all), open-protocol-integrations (all), mcp (all tools), push, notifications (controller, gateway, service, delivery service), mailer, plus the entities/contracts they touch. `ai-analysis` does not exist as a module at this commit (see verdicts).

## Findings

| Sev | Conf | Module | file:line | Title |
|---|---|---|---|---|
| CRITICAL | CONFIRMED (code trace, not executed) | telegram | `modules/telegram/telegram.service.ts:1087-1113`, `:962-974`, `telegram-bot-webhook.guard.ts:18-22`, `telegram-bots.service.ts:46-48` | Forged update on a workspace-owned bot reads/writes/deletes in the victim's workspace (chat→user mapping is global, not per bot) |
| HIGH | CONFIRMED | gmail | `modules/gmail/gmail.controller.ts:484, :671, :548-551, :985-988` | Client `categoryId` written to transactions without workspace check (approve / bulk-approve / parsed-data / updateReceipt→syncLinkedTransaction) |
| MEDIUM | CONFIRMED | telegram | `telegram.service.ts:598-622, :814-845, :656-713` | Bot actions only check membership: a viewer/demoted member whose chat is still linked can create receipts and delete any receipt/statement by id |
| MEDIUM | LIKELY | push | `modules/push/push.service.ts:85-92`, `packages/contracts/src/requests/push.ts:13-15` | Push endpoint URL is user-supplied and POSTed to without egress check (blind SSRF to internal https hosts) |
| MEDIUM | CONFIRMED | webhooks | `webhook-subscriptions.controller.ts:32-40`, `webhook-endpoints.controller.ts:23-33` | Outbound subscriptions (event exfil to external URL) and inbound tokens creatable by a plain member with the statements toggle, not INTEGRATION_MANAGE |
| MEDIUM | CONFIRMED | gmail | `gmail.controller.ts:435-464`, `dto/update-receipt.dto.ts:11-21` | `PATCH receipts/:id` merges an unvalidated `@IsObject() parsedData` into the jsonb (nested mass-assignment: categorySource/categoryReason/lineItems/validationIssues…) |
| LOW | CONFIRMED | webhooks | `webhook-inbound.service.ts:26-33, :77, :110` | Inbound uploads run as the workspace OWNER regardless of who minted the token; `defaultWalletId/defaultBranchId` stored unvalidated (currently unused by `statements.create`) |
| LOW | CONFIRMED | push | `push.service.ts:46-53` | `subscribe` re-assigns an existing endpoint row to the caller (endpoint hijack / silent DoS of another user's device if the endpoint is known) |
| LOW | CONFIRMED | notifications | `notifications.gateway.ts:132-141` | `join-workspace` joins any workspace room without a membership check (latent: nothing is emitted to workspace rooms today) |
| LOW | CONFIRMED | gmail/google-drive/dropbox | `oauth-integration-base.service.ts:57-75` | OAuth `state` has no nonce/expiry/single-use and is not bound to the browser session; same HMAC secret (JWT_SECRET) across the three providers |
| LOW | CONFIRMED | mailer/notifications | `mailer.service.ts:44-48`, `notification-delivery.service.ts:82-88, :226` | Notification e-mails are sent through the recipient's HOME-workspace SMTP, not the workspace the notification is about |
| LOW | CONFIRMED | gmail | `gmail-receipt-export.service.ts:83-97` | xlsx export written to `uploads/exports/<timestamp>.xlsx` and returned as `/uploads/exports/...`, which is not mounted (dead link; files accumulate outside any auth) |
| LOW | CONFIRMED | telegram | `telegram.controller.ts:60-68`, `telegram.service.ts:193-194` | `send-report` accepts an arbitrary `chatId` (data the caller may already read, pushed to any chat that has started the bot) |
| LOW | CONFIRMED | open-protocol-integrations | `open-protocol-integrations.service.ts:1102-1123, :278-302` | `assertS3Connection` builds an S3Client without the pinned-DNS agents (TOCTOU vs `assertPublicEgressUrl`); `imap/folders` lets an admin use the server as an IMAP credential/port prober against public hosts |

### 1. CRITICAL — Telegram: forged update on a workspace bot acts in another workspace

**Path.** `POST /api/v1/telegram/webhook/:botId` (`@Public()`, `TelegramBotWebhookGuard`) → guard accepts when header `x-telegram-bot-api-secret-token` equals `webhookSecretOf(token)` = `sha256("seneca-telegram-webhook:" + botToken)` and `botId` is in `TelegramBotsService.bots` (filled by `sync()` from `ApplicationSettingsService.listTelegramBots()`, which includes **every workspace's own bot token**) → `TelegramService.handleUpdate(update, botToken)` → `dispatchUpdate` → for `/report`, `/goals`, `/networth`, photos, documents, free text, callback buttons: `findUserByTelegram(message.from.id, chat.id)` → `resolveWorkspaceId(user)` = `user.telegramWorkspaceId ?? user.workspaceId` (membership check only) → reports/writes run in **that** workspace and the reply is sent to `chat.id` through the inbound bot.

Nothing ties the matched user to the bot the update came in on. `linkChat` does check `claim.botId === botIdOf(botToken)` at link time, but the binding is not persisted and `findUserByTelegram` is a global lookup on `users.telegram_id OR users.telegram_chat_id`.

**Exploit.** Attacker A owns any workspace W2 (owner/admin → `WORKSPACE_SETTINGS_MANAGE` → `PUT /application-settings/notifications/telegram` with their own bot token T2; `assertTelegramConnection` only needs a valid token). Within 5 min `sync()` registers bot id `B2 = T2.split(':')[0]`. A knows T2, so A computes the webhook secret. Victim V has Telegram connected in workspace W1 (via the shared bot or W1's bot); V's numeric Telegram id is not secret (any "userinfo" bot, forwarded messages, client APIs). A sends:

```
POST /api/v1/telegram/webhook/B2
x-telegram-bot-api-secret-token: sha256("seneca-telegram-webhook:" + T2)
{"update_id":1,"message":{"chat":{"id":<A's own chat with B2>},"from":{"id":<V's telegram id>},"text":"/report monthly"}}
```

→ `handleReportCommand` finds V, resolves W1, `reportsService.generateMonthlyReport(W1, …)` and `sendMessage(chatId=A's chat, …)` via bot T2 → A receives W1's monthly income/expense/top-counterparty report in their own chat. Same for `/goals`, `/networth`, daily reports; free text `"coffee 4.50"` books an expense in W1; a `document` update imports a statement into W1 (file fetched from Telegram with T2 — A controls the file); `callback_query` with `data: "rcpt:del:<uuid>"` / `"stmt:del:<uuid>"` deletes any receipt/statement of W1 whose uuid A knows. Works whether B2 is in webhook or polling mode (route and guard exist either way). Replies also land in `telegram_reports` under V's user id.

**Evidence.**
```ts
// telegram-bot-webhook.guard.ts
const botToken = this.bots.tokenOf(request.params.botId ?? '');
if (!(botToken && secretsMatch(provided, webhookSecretOf(botToken)))) throw …
// telegram.service.ts findUserByTelegram
query.andWhere('(user.telegramId = :telegramId OR user.telegramChatId = :chatId)', { telegramId, chatId });
// resolveWorkspaceId
const workspaceId = user.telegramWorkspaceId ?? user.workspaceId;
```

**Fix.** Persist the bot the chat was linked through (`users.telegram_bot_id`, set in `linkChat` from `claim.botId`) and require `user.telegramBotId === botIdOf(botToken)` in `findUserByTelegram`/`resolveSender`; additionally require that the inbound bot is the bot configured for `resolveWorkspaceId(user)` (or the shared bot). Consider a per-bot random webhook secret stored server-side instead of a value derivable from the token the workspace admin supplied.

**Tests.** `telegram.service.spec.ts` covers "refuses a code issued for another bot" at link time only; no test for a post-link update arriving on a different bot. No e2e.

### 2. HIGH — Gmail: client `categoryId` reaches `transactions.category_id` without a workspace check

**Path.** `POST /integrations/gmail/receipts/:id/approve` (`STATEMENT_EDIT`) → `approveReceipt` builds `{ categoryId: dto.categoryId || receipt.parsedData?.categoryId || null }` → `ReceiptsService.approveOnce` → `transactions.save(transactions.create(withLedgerSides({...buildTransaction(receipt)…})))` (receipts.service.ts:571-573) — no `assertWorkspaceOwned`. Same for `POST receipts/bulk-approve` (`dto.categoryId`, `@IsUUID`), `PATCH receipts/:id/parsed-data` (`dto.categoryId` is `@IsString()`, merged into `parsedData` and then `syncLinkedTransaction` does `transaction.categoryId = categoryId; save()`), and `PATCH receipts/:id` (`parsedData` object, see finding 6). `ApproveReceiptDto.categoryId` is `@IsString()` — a non-uuid string produces a 500 from Postgres.

Contrast: `TransactionsService.update` (and `bulkUpdate`, which delegates to it) runs `assertWorkspaceOwnedRefs` → `assertWorkspaceOwned(Category, …)`; `StatementsService.createManualExpense` looks the category up with `{ id, workspaceId }`. The Gmail receipt routes bypass both, so a member of A with `canEditStatements` (or an API key with `STATEMENT_EDIT`) creates an A transaction that references B's category id (FK `transactions.category_id → categories.id` is satisfied by any workspace's category). Effect: A→B dangling reference in reports/exports/tax packs (the prior sweep's "cross-tenant reference" class), category-name resolution in A shows a foreign/unknown category, and B's category cannot be deleted while referenced.

**Evidence.**
```ts
// gmail.controller.ts:476-486
const result = await this.receiptsService.approveOnce(id, workspaceId, receipt => ({
  …, categoryId: dto.categoryId || receipt.parsedData?.categoryId || null, …}));
// gmail.controller.ts:985-988 (syncLinkedTransaction)
if (categoryId) { transaction.categoryId = categoryId; }
await this.transactionRepository.save(transaction);
```

**Fix.** In the three Gmail routes (and in `ReceiptsService.bulkApprove`, which has the same gap for the REST receipts route — outside this group) resolve `categoryId` with `categoryRepository.findOne({ where: { id, workspaceId } })` before use; make the DTO fields `@IsUUID()`.

**Tests.** `cross-workspace-references.e2e-spec.ts` covers rules/budgets/subscriptions/tax rules/categories/file tags/invoice tax rates — not receipt approval. None for this path.

### 3. MEDIUM — Telegram bot actions bypass workspace role/toggles

**Path.** Every inbound action goes through `resolveSender` → `resolveWorkspaceId` which only checks `workspace_members` membership (any role). `statementsService.create` / `createManualExpense` do call `ensureCanEditStatements`, but `receiptsService.createFromScan` (photo → receipt) and `receiptsService.delete` / `statementsService.remove` (callback buttons) have no permission check of their own; via REST those are behind `STATEMENT_EDIT`/`STATEMENT_DELETE`.

**Exploit.** Linking requires `TELEGRAM_CONNECT` (owner/admin only). A user who linked as admin and was later demoted to viewer/accountant/member keeps `telegram_chat_id` + `telegram_workspace_id`. They send a photo → receipt created in the workspace (viewer write); they send a `callback_query` with `rcpt:del:<uuid>` (uuids are visible to a viewer via the receipts list) → receipt (and its scan statement) deleted. Combined with finding 1 the same primitives are available cross-tenant.

**Fix.** In `resolveSender` require `workspaceRoleAllows(STATEMENT_UPLOAD|STATEMENT_DELETE, role, permissions)` per action, or clear `telegram_*` on role downgrade/removal; make `ReceiptsService.delete`/`createFromScan` enforce the toggle like statements do.

**Tests.** `telegram.service.spec.ts` asserts membership loss (`ws-left`) only.

### 4. MEDIUM — Web push: user-supplied endpoint POSTed without egress check

**Path.** `POST /push/subscriptions` (`JwtAuthGuard`) stores `dto.endpoint` (contract: `^https:\/\/\S+$` only) → every notification to that user → `webPush.sendNotification({ endpoint })` → HTTPS POST from the server to the URL. No `assertPublicEgressUrl`, no pinned DNS. Response body is not surfaced; 404/410 delete the row (observable via `GET /push/subscriptions`), other errors go to logs.

**Exploit.** Any user registers `https://10.0.0.5:8443/admin` (or an internal hostname), then triggers their own notifications (e.g. upload a statement). The server POSTs to the internal host with a VAPID `Authorization` header and an encrypted body; the 404/410-vs-other distinction gives a 1-bit oracle for internal https services. Blind and https-only, hence MEDIUM rather than HIGH.

**Fix.** `await assertPublicEgressUrl(dto.endpoint)` in `subscribe`, and ideally restrict to known push-service hosts (`fcm.googleapis.com`, `*.push.apple.com`, `*.notify.windows.com`, `updates.push.services.mozilla.com`, …). Tests: `push.service.spec.ts` exists; no SSRF case.

### 5. MEDIUM — Webhook subscriptions/endpoints with statement permissions

`POST /webhook-subscriptions` is `STATEMENT_UPLOAD`; a plain member with `canEditStatements` can register an external URL and receive `transaction.created` (amount, counterparty, category), payables, budgets, tax-threshold events for the whole workspace, including rows marked private by other members (payloads carry ids/amounts, not the privacy flag). `POST /webhook-endpoints` (`STATEMENT_UPLOAD`) mints an inbound token whose uploads run as the workspace **owner** (`resolveWorkspaceOwner`), so the token-holder's uploads satisfy `ensureCanModify` owner checks later. Delete is `STATEMENT_DELETE`. The egress guard, secret handling (returned once, redacted from audit) and per-workspace scoping of list/get/update/delete/deliveries/retry are correct (`findOne({id, workspaceId})`, `findOneScoped` joins `sub.workspaceId`); the previously fixed cross-tenant delivery bug is not present: `findActiveByWorkspaceAndEvent` filters by `sub.workspaceId` and `dispatch` is called with the event's `workspaceId`.

**Fix.** Gate create/update/delete of both resources on `INTEGRATION_MANAGE`; attribute inbound uploads to the endpoint creator (store `createdByUserId`) rather than the owner.

### 6. MEDIUM — Gmail `PATCH receipts/:id` nested mass-assignment

`UpdateReceiptDto.parsedData` is `@IsObject()` with no `@ValidateNested`; the global whitelist does not descend into it. `receipt.parsedData = { ...receipt.parsedData, ...dto.parsedData }` then `syncLinkedTransaction` copies `amount/currency/vendor/date/categoryId` to the linked transaction (including a `taxLocked` one — the Gmail path does not check `taxLocked`, unlike `approveOnce`). Any jsonb keys (`categorySource`, `categoryReason`, `lineItems`, `validationIssues`, `transactionMatch`, …) can be set to arbitrary values. Fix: typed nested DTO + category check; respect `taxLocked` in `syncLinkedTransaction`.

### 7–14. LOW items (one paragraph each)

- **Inbound webhook attribution / default ids** (`webhook-inbound.service.ts`): uploads are created as the OWNER user; `defaultWalletId`/`defaultBranchId` and `WebhookStatementUploadBody.walletId/branchId` are passed to `statementsService.create`, which currently ignores both parameters (dead args), so no cross-tenant wallet reference today — but the ids are stored on `webhook_endpoints` unvalidated and would become a reference the day `create` starts using them. Validate against the workspace on create/update.
- **Push subscribe endpoint takeover** (`push.service.ts:46-53`): `findOne({ where: { endpoint } })` then `row.userId = userId` — a caller who knows another user's endpoint URL moves the row (and overwrites its keys) to themselves; the victim's device then receives undecryptable pushes. Scope the lookup by `userId` and reject/replace rather than reassign.
- **Gateway `join-workspace`** (`notifications.gateway.ts:132-141`): no membership check. Handshake auth is solid (JWT + tokenVersion + session revocation, cookie or header). Only `user:<id>` rooms are emitted to, so no leak today; add a `workspace_members` check before `client.join` so the latent hole cannot be opened by a future `server.to(workspace:…)` emit. Mark-read is scoped by `recipientId`.
- **OAuth state** (`oauth-integration-base.service.ts`): HMAC-signed `{userId, workspaceId, redirect}`; `redirect` is ignored (no open redirect — the frontend base comes from env), the workspace is re-checked for owner/admin at callback, tokens are encrypted at rest and never returned (status routes return settings/scopes only). Missing: nonce/expiry/single-use and binding to the browser session, so a captured `state` can be replayed indefinitely with a fresh `code` (classic OAuth login-CSRF: the victim's workspace gets the attacker's mailbox/drive connected). Add `iat`/`exp` and a cache-backed one-time nonce; use separate secrets per provider.
- **Mailer SMTP selection**: `NotificationDeliveryService.sendOne`/`sendDigest` call `mailerService.send({ user })` without `workspaceId`, so `getSmtpSettings` picks the recipient's home-workspace SMTP for notifications about other workspaces (the `SendMailParams.workspaceId` doc comment already names this). SMTP hosts are egress-checked on save (`saveSmtpSettings` → `assertPublicEgressHost`). Pass `notification.workspaceId`.
- **Gmail xlsx export**: writes to `uploads/exports/receipts-<Date.now()>.xlsx` and returns `/uploads/exports/...`; `resolveStaticAssetMounts` does not mount `exports`, so the link is dead and files pile up on disk. Either serve through an authenticated route or stream the workbook.
- **Telegram `send-report` chatId**: a `TELEGRAM_SEND` member can direct the workspace report to any chat that has started the bot. Low (caller can already read the data); drop the field or restrict to the caller's own chat.
- **OPI**: `assertS3Connection` builds `new S3Client` without `createPublicEgressHttpAgents()` (the runtime client does use them), so the save-time probe is vulnerable to DNS rebinding between `assertPublicEgressUrl` and connect; `POST integrations/imap/folders` takes arbitrary host/port/user/pass and connects (egress-checked) — a credential/port prober against public hosts for any `INTEGRATION_MANAGE` member. `importStatementAttachment` uses `Like('%'+messageIdTail+'%')` with a tail taken from the e-mail `Message-ID` (wildcards possible; dedupe-only impact).

## Per-module verdicts

- **gmail** (+ gmail-webhook, scheduler): 19 routes; all data routes `@WorkspaceAuth`, every receipt lookup scoped `{ id, workspaceId }`, export/mark-duplicate/original ids scoped, attachment paths come from the DB (absolute or under uploads), thumbnails to `/tmp` with uuid-ish names, Gmail API calls fixed-host. Holes: finding 2 (categoryId → transaction), finding 6 (parsedData mass-assignment / taxLocked), LOW export-dir. `status` route is membership-only (returns filter config/scopes — acceptable). Pub/Sub webhook: bearer token compared with `secretsMatch`, deny-when-unset, integration resolved by watch `emailAddress`; replay only bumps `historyId` (no data effect). Scheduler/processor: iterate integrations and write with `integration.workspaceId`; jobs carry `workspaceId`; version workspaces excluded. OAuth callback: see LOW state note.
- **google-drive** (+ scheduler): clean — 8 routes, callback resolves workspace from signed state and re-checks owner/admin, tokens encrypted, `picker-token` returns a live Drive access token to owner/admin (by design), import validates MIME/size/name, sync query scoped by `integration.workspaceId`. LOW: OAuth state replay.
- **dropbox** (+ scheduler): clean — same base class; `importFiles` fileId is a Dropbox path (remote-side only); MIME inferred from extension then `validateFile`. LOW: OAuth state replay.
- **telegram** (+ webhook, scheduler): finding 1 (CRITICAL), finding 3 (MEDIUM), LOW send-report chatId. Link codes: 24 random bytes, hashed cache key, 10-min TTL, single-use, bot-bound at link time (good). Manual webhook (`/telegram/webhook`) requires `TELEGRAM_WEBHOOK_SECRET`. Scheduler sends to `telegramWorkspaceId` after membership check. Workspace bot settings are `WORKSPACE_SETTINGS_MANAGE`; shared/instance bot is instance-admin only (not re-verified beyond the controller decorators).
- **webhooks**: subscriptions/endpoints/deliveries all scoped by workspace on list/get/update/delete/retry/deliveries; fan-out picks subscriptions by the event's workspace; outbound URL egress-checked at create, update and send time with pinned DNS and no redirects; HMAC signature; secrets/tokens returned once and redacted from audit; inbound token 32 random bytes, `isActive` checked, plugin gate. Holes: finding 5 (permission level), LOW attribution/default ids.
- **open-protocol-integrations** (S3-compatible, WebDAV, IMAP): all routes `WorkspaceContextGuard`/`INTEGRATION_MANAGE`; integration + settings resolved by `{ workspaceId, provider }`; endpoints/hosts egress-checked on save and on use (runtime S3/WebDAV/IMAP clients use the pinned-lookup agents); secrets encrypted; imports go through `validateFile` + `statementsService.create` in the request workspace; IMAP receipts written with `workspaceId` and deduped per workspace; S3 auto-backup takes workspace+statement from the event. LOW: probe-client TOCTOU, imap/folders prober.
- **mcp**: clean — API key only (`McpAccessGuard`), workspace = key's workspace (forced by JwtAuthGuard), plugin gate, per-tool permissions checked with the same table as REST, no tool accepts `workspaceId`, strict input decoding, output projected to the route contract and stripped of `ACCOUNT_KEYS`, private rows honoured via `memberId` (`list_transactions`, `get_statement`, review, tax report). Writes go through services that validate foreign ids (`transactions.update` → `assertWorkspaceOwnedRefs`; `bulkUpdate` delegates to it; `budgets.create` covered by e2e). `upload_statement` walletId/branchId are ignored by `statements.create`. e2e `mcp.e2e-spec.ts` covers cross-workspace, scopes, viewer read-only, plugin off.
- **push**: user-scoped (`listForUser`, `delete({ userId, endpoint })`); VAPID keys from env, private key never returned. Holes: finding 4 (SSRF), LOW endpoint takeover.
- **notifications** (incl. gateway): list/unread/mark-all scoped by `recipientId` + header workspace; `mark-read` scoped by `recipientId`; preferences user-scoped with boolean/known-key normalisation; gateway handshake validates JWT + tokenVersion + session, CORS allowlist. LOW: `join-workspace` unchecked (latent), home-workspace SMTP for e-mail channel.
- **mailer**: thin nodemailer wrapper; recipients come from `user.email` in callers; subject/text are rendered from translation tables with params (no template engine → no template injection); SMTP host per workspace is egress-checked on save. LOW: workspace selection for notification mail.
- **ai-analysis**: no such module/directory at this commit; `grep -ri "openai|anthropic|llm|ai-analysis"` in `backend/src` hits only a comment in `parsing/services/universal-extractor.service.ts` (a sender-name example). No remaining LLM endpoint or external AI call. Clean (removed).

## Not checked / uncertainty

- Finding 1 is traced through code (guard → service → repositories) but not executed against a running stack; the only runtime assumption is that `listTelegramBots()` returns workspace-level tokens (it does, `application-settings.service.ts:489-516`) and that `sync()` has run (every 5 min and on `createLink`).
- Finding 4's exploitability depends on `web-push` following/announcing errors; I did not read the library. Rated MEDIUM/LIKELY.
- `ReceiptsService.bulkApprove` / REST `receipts/bulk-approve` has the same unvalidated `categoryId` as finding 2 — noted but it belongs to the receipts group.
- Instance-admin routes for the shared Telegram bot (`saveInstanceTelegramSettings`) were only checked via decorators in `application-settings.controller.ts`, not read in full (other group).
- `gmail-receipt-parser.service.ts` (505 lines, local parsing, no network calls per grep) and `telegram-translations.ts` were not read line by line.
- Multer config for inbound webhooks (`config/multer.config.ts`) and `validateFile` internals not re-read (other group).
