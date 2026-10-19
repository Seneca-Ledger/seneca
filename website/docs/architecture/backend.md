---
title: Backend Architecture
description: NestJS modules, guards, and decorators
---

The backend is a NestJS 11 application organized into 47 feature modules under `backend/src/modules`.

## Module layout

- Identity and tenancy: `auth`, `users`, `workspaces`, `api-keys`
- Ingestion: `statements`, `parsing`, `import`, `transactions`, `receipts`, `data-entry`
- Categorization: `classification`, `categories`, `insights`
- Finance: `dashboard`, `reports`, `balance`, `ledger` (double-entry journal and its reports), `budgets`, `goals`, `net-worth`, `crypto`, `subscriptions`,
  `payables`, `wallets`, `branches`, `exchange-rates`
- Tax: `tax` (VAT rates, rules, jurisdictions, returns) and `income-tax` (year-end income tax declaration drafts)
- Maps: `maps` (tile proxy) and `geocoding` (Nominatim client)
- Integrations: `open-protocol-integrations` (S3-compatible, WebDAV, IMAP), `mailer`, `telegram`, `webhooks`,
  `application-settings`, plus the legacy `gmail`, `google-drive`, and `dropbox`
- Platform: `audit`, `notifications`, `notes`, `storage`, `custom-tables`, `search`, `backups`, `observability`

## Request pipeline

Three global guards run on every HTTP request:

1. **`CsrfGuard`** — double-submit check on cookie-authenticated `POST`/`PUT`/`PATCH`/`DELETE`: the readable
   `csrf_token` cookie must be echoed in the `x-csrf-token` header. Requests carrying `Authorization` or
   `X-Api-Key` are exempt, and `@SkipCsrf()` opts out routes that start a session.
2. **`JwtAuthGuard`** — authenticates with the HttpOnly `access_token` cookie, a Bearer token, or an `X-Api-Key`
   API key. `@Public()` opts a route out.
3. **`ThrottlerGuard`** — 500 requests per minute by default, counted in Redis when `REDIS_URL` is set. Auth routes
   add tighter `@Throttle()` limits.

Workspace-scoped controllers add `@WorkspaceAuth(Permission.X)`, which applies `JwtAuthGuard`,
`WorkspaceContextGuard`, and `PermissionsGuard` together. `@RequirePermission()` declares permissions for
`PermissionsGuard` directly.

`main.ts` also applies helmet (including a Content-Security-Policy), a CORS allowlist from `CORS_ORIGINS`
(falling back to `FRONTEND_URL`), a global validation pipe, and `trust proxy`, so rate limits key on the client IP
behind a reverse proxy.

## Sessions

Login sets `access_token` (30 minutes by default) and `refresh_token` (30 days) as HttpOnly cookies, plus a
readable `csrf_token` cookie; the response body carries no token. Refresh tokens rotate on every use. A password
reset invalidates every existing session.

## Audit logging

Most mutation endpoints are decorated with `@Audit()`, which records old/new values and can generate rollback
instructions. Entries are stored in the `audit_events` table and served under `/audit-events`.

## API documentation

Swagger (OpenAPI) is served when `NODE_ENV` is not `production`:

```
http://localhost:3001/api/docs
```

## Real-time updates

The Socket.IO gateway lives in the `notifications` module: clients join a workspace room and receive
`notification:new` events. Statement parsing runs in the BullMQ processor under `parsing/queue`.

## Health checks

- `GET /api/v1/health` — liveness
- `GET /api/v1/health/ready` — checks the database and returns 503 when it fails

Next: [Frontend Architecture](frontend)
