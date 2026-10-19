---
paths:
  - "backend/**"
---

# Security & Privacy Standards

## 1. Authentication & Session Management
- **JWT Storage**: Store access and refresh tokens in `HttpOnly` cookies (`auth-cookies.ts`), `Secure` in production. Never return them in response bodies or store them in `localStorage`.
- **SameSite**: The default is `Lax`, not `Strict` — OAuth callbacks come back as a cross-site top-level redirect, and `Strict` would drop the session on it. `AUTH_COOKIE_SAMESITE=none` is for split-domain HTTPS deployments. Don't "tighten" this to `Strict`.
- **CSRF**: `CsrfGuard` is global. Cookie-authenticated `POST`/`PUT`/`PATCH`/`DELETE` must echo the `csrf_token` cookie in `x-csrf-token`; `Authorization`/`X-Api-Key` callers are exempt. Mark only session-establishing routes `@SkipCsrf()`.
- **Token Rotation**: Refresh tokens rotate on every use.
- **Session Expiry**: Access tokens default to 30 minutes, refresh tokens to 30 days.
- **Secrets & Hashing**: Read secrets through `requireSecret` (no literal fallbacks); hash passwords through `hashPassword` (`BCRYPT_ROUNDS`).

## 2. Data Protection (PII)
- **Encryption at Rest**: Sensitive data (bank details, personal names, keys) must be encrypted in the database using high-standard algorithms (AES-256).
- **Masking**: Display only the last 4 digits of bank accounts or cards in the UI.
- **Sanitization**: All user inputs must be sanitized using `class-validator` and `DOMPurify` to prevent XSS and SQL injection.

## 3. Authorization (RBAC/ABAC)
- **Fail-Safe Defaults**: Access must be denied by default. Explicitly grant permissions.
- **Multi-Level Check**: Check permissions at the Controller level (Interceptor/Guard) AND at the Domain/Service level to prevent vertical/horizontal privilege escalation.
- **Tenant Isolation**: Every query must include a `workspaceId` or `ownerId` check to ensure the user cannot access data from other tenants. That includes ids from a request body (a category, a tag, a tax rate): look them up with the caller's `workspaceId`. The isolation sweep (`@tests/e2e/workspace-isolation-sweep.e2e-spec.ts`) checks every route; give a new kind of record a seed step in `@tests/e2e/helpers/seed-workspace.ts`.

## 4. API Security
- **CORS**: Only the `CORS_ORIGINS` allowlist (falling back to `FRONTEND_URL`) may make credentialed requests.
- **Rate Limiting**: Add a tighter `@Throttle()` to sensitive endpoints (login, register, forgot/reset password, 2FA) on top of the global Redis-backed limit.
- **Outbound Requests**: Fetch user-supplied URLs only through the egress guard (`egress-url.util.ts`).
- **Security Headers**: Use `Helmet.js` to set `Content-Security-Policy`, `X-Frame-Options`, etc.
