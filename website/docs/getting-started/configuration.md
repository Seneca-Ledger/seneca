---
title: Configuration
description: Environment variables and integration setup
---

Stoic Budget ships with working defaults for local development — `npm run setup:env` generates them.
Production deployments need real secrets and a few settings that match how you host Stoic Budget.

## Root environment (.env)

Docker Compose reads the root `.env` for variable substitution and also passes it to the backend
container. `docker-compose.yml` refuses to start without:

```bash
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=finflow              # optional, defaults to finflow
JWT_SECRET=                      # openssl rand -base64 32
JWT_REFRESH_SECRET=
INTEGRATIONS_ENCRYPTION_KEY=
```

Compose builds the backend's `DATABASE_URL` from the `POSTGRES_*` values, so a `DATABASE_URL` in
`.env` does not change it.

Also set for production:

- `FRONTEND_URL` or `CORS_ORIGINS` — the backend does not start in production without an allowed origin
- `BACKUP_MASTER_KEY` (and `BACKUP_LOCAL_ROOT` for a server folder) for scheduled backups
- `METRICS_AUTH_TOKEN` if you scrape `/api/v1/metrics` — see [Observability](../guides/observability)
- `TELEGRAM_WEBHOOK_SECRET` when the Telegram webhook is enabled

Optional: `IMAGE_TAG` pins the prebuilt GHCR images, and `DB_QUERY_LOGGING=true` logs every SQL
query.

## Sessions, CORS and security

Browsers authenticate with HttpOnly cookies (`access_token`, `refresh_token`). Cookie-authenticated
writes must echo the readable `csrf_token` cookie in the `x-csrf-token` header; the frontend does this
for you. Scripts can send `Authorization: Bearer <token>` or `X-Api-Key: lum_…` instead and skip the
CSRF check.

| Variable | Default | When to set it |
|---|---|---|
| `CORS_ORIGINS` | `FRONTEND_URL` | Comma-separated origins allowed to make credentialed requests. In production this is the whole allowlist. |
| `AUTH_COOKIE_SAMESITE` | `lax` | `none` when the frontend and API are on different registrable domains. It forces `Secure`, so HTTPS only. |
| `AUTH_COOKIE_DOMAIN` | unset | Share the cookies across subdomains, e.g. `.example.com`. |
| `JWT_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | `30m` / `30d` | Access and refresh token lifetimes; refresh tokens rotate on use. |
| `PASSWORD_RESET_TOKEN_SECRET` | `JWT_SECRET` | A separate HMAC key for password reset tokens. |
| `BCRYPT_ROUNDS` | `12` | Work factor for new password hashes (10–15). |

## Receipt maps

`TILESERVER_URL`, `GEOCODER_URL`, `MAP_DEFAULT_STYLE` and `MAP_PBF_URL` enable the self-hosted receipt
map. Leave them unset to keep the feature off. See [Receipt Maps](../guides/receipt-maps).

## Backend environment (backend/.env)

When the backend runs on your host, it reads `backend/.env`. The generated development values:

```bash
DATABASE_URL=postgresql://finflow:finflow@localhost:5434/finflow
REDIS_URL=redis://localhost:6379
JWT_SECRET=<generated>
JWT_REFRESH_SECRET=<generated>
INTEGRATIONS_ENCRYPTION_KEY=<generated>
```

`backend/.env.all-options` lists every infrastructure setting — parsing timeouts, concurrency,
storage paths and more. Treat it as a reference and copy single values, not the whole file.

## Integrations

Configure SMTP, S3-compatible storage, WebDAV, IMAP, Telegram and the public App URL in
the app under **Integrations** and **Settings**. Their credentials are stored encrypted per workspace;
env values with the same purpose are only temporary fallback defaults. See
[Integrations](../guides/integrations).

## Frontend environment

- `NEXT_PUBLIC_API_URL` — the API base URL seen by the browser
- `NEXT_PUBLIC_SUPPORT_EMAIL` — where "report an error" in the tax screens sends people

`NEXT_PUBLIC_*` values are compiled into the frontend at build time, so the prebuilt image needs a
rebuild to change them. The Next.js server proxies `/api/*` and `/uploads/*` to `API_PROXY_TARGET`
(default `http://127.0.0.1:3001`; the Docker dev stack uses `http://backend:3001`).

## Secrets management

- Never commit `.env` files or API keys.
- Use Docker secrets or a secret manager for infrastructure secrets.
- Store integration credentials through the UI so they are encrypted per workspace.
- Rotate protocol credentials and JWT keys regularly.

Next: [Demo Mode](demo-mode)
