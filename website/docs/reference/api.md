---
title: API Overview
description: REST API structure and authentication
---

The Stoic Budget API is served from the backend at `/api/v1`.

## Base URLs

- Local: `http://localhost:3001/api/v1`
- Swagger: `http://localhost:3001/api/docs` (not served when `NODE_ENV=production`)

## Authentication

- **Browser sessions**: `POST /auth/login` sets the HttpOnly `access_token` (default 30 minutes) and
  `refresh_token` (default 30 days) cookies; the response body carries no token. `POST /auth/refresh` rotates the
  refresh token.
- **CSRF**: cookie-authenticated `POST`, `PUT`, `PATCH`, and `DELETE` requests must send the value of the readable
  `csrf_token` cookie in the `x-csrf-token` header.
- **Scripts and integrations**: send an access token as `Authorization: Bearer <token>` or an API key in
  `X-Api-Key` (keys are managed under `/api-keys`). Header-authenticated requests skip the CSRF check.
- Routes marked `@Public()` — health checks, login, registration, password reset — need no credentials.

## Core API domains

- `/auth` — register, login, refresh, logout, logout-all, sessions, me, 2FA, forgot/reset password
- `/users` — profile, preferences, avatar and content background, email change (`PATCH /users/me/email`, then
  `POST /users/me/email/confirm`)
- `/workspaces` — workspace management, members, invitations
- `/statements` — upload, metadata, reprocessing, import preview (`/statements/:id/import-preview`) and commit
  (`/statements/:id/import-commit`)
- `/import-sessions` — import session status and cancellation
- `/transactions` — normalized bank transactions
- `/receipts` — receipts, including `PATCH` and `DELETE /receipts/:id/location`, the Documents list feed
  (`GET /receipts/documents`) and `GET /receipts/:id/thumbnail`
- `/documents` — parser operations and debug tools
- `/dashboard`, `/reports` — dashboards and reporting (for example `GET /dashboard/cash-flow?range=`)
- `/budgets`, `/goals`, `/subscriptions`, `/custom-tables`
- `/payables` — bills and receivables; `GET /payables/:id/payment-candidates` lists transactions that may have
  settled one, and `PUT /payables/:id/mark-paid` takes either `linkedTransactionId` or `payFromWalletId`
  (with optional `paidOn` and `categoryId`) to record a cash payment as a wallet transaction
- `/ledger` — double-entry ledger: `settings` (switch on in a base currency) and `integrity`, `accounts` (chart of
  accounts), `entries` (drafts, `:id/post`, `:id/reverse`), `revaluations` (`POST {date}` revalues
  foreign-currency balances at that day's rate), and `reports/trial-balance`, `reports/profit-and-loss`,
  `reports/balance-sheet`, `reports/accounts/:id`; reports answer `409 LEDGER_NOT_UP_TO_DATE` while transactions are
  still being posted unless `allowStale=true`
- `/tax/jurisdictions`, `/tax/rules`, `/tax/returns`, `/tax-rates` — VAT
- `/income-tax` — income tax declaration: disclaimer, profile, line mappings, and `returns/:taxYear` with
  `finalize`, `reopen`, and `export?format=pdf|xlsx`
- `/maps` — tile styles and proxied tiles for receipt maps
- `/audit-events` — audit history
- `/integrations` — S3-compatible, WebDAV, and IMAP settings
- `/telegram`, `/webhook-endpoints`, `/webhook-subscriptions`, `/webhook-deliveries`, `/api-keys`
- `/health`, `/health/ready`, `/metrics`

## Error handling

Errors return JSON in this shape:

```json
{
  "error": { "code": "...", "message": "...", "details": {} },
  "requestId": "...",
  "traceId": "...",
  "timestamp": "...",
  "path": "/api/v1/..."
}
```

The same IDs come back in the `x-request-id` and `x-trace-id` response headers; use them to find the request in the
logs.

## Rate limiting

`ThrottlerGuard` applies globally: 500 requests per minute by default, counted in Redis when `REDIS_URL` is set.
Login, registration, and reset-password allow 5 requests per minute, forgot-password 3. Responses also carry
helmet security headers.

For the full endpoint reference, use Swagger.
