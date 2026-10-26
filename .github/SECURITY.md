# Security Policy

## Supported Versions

Seneca is self-hosted and has not cut a tagged release yet. Security fixes land on `main` and ship in
the next published image.

| Version                         | Supported          |
| ------------------------------- | ------------------ |
| `main` and the latest release   | :white_check_mark: |
| Older releases                  | :x:                |

## Reporting a Vulnerability

We take the security of Seneca seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Where to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Report them through **GitHub Security Advisories**:

- Open https://github.com/stoic-budget/stoic-budget/security/advisories/new (the Security tab of this repository)
- Click "Report a vulnerability"
- Fill out the form with details

If you cannot use advisories, contact a maintainer through GitHub and ask for a private channel before sharing any details.

### What to Include

Please include the following information in your report:

- Type of vulnerability (e.g., SQL injection, XSS, authentication bypass)
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it
- Any suggested fixes or mitigations

### What to Expect

After you submit a report, here's what will happen:

1. **Acknowledgment**: We'll acknowledge receipt of your vulnerability report within 48 hours
2. **Initial Assessment**: We'll provide an initial assessment within 7 days
3. **Updates**: We'll keep you informed about our progress as we work on a fix
4. **Resolution**: Once the vulnerability is fixed, we'll notify you and publicly disclose it (with credit to you, if desired)

### Disclosure Policy

- We ask that you give us a reasonable amount of time to fix the vulnerability before any public disclosure
- We aim to fix critical vulnerabilities within 30 days
- Once a fix is available, we will:
  - Release a security update
  - Publish a security advisory
  - Credit you for the discovery (unless you prefer to remain anonymous)

## Security Best Practices

When deploying Seneca, please follow these security best practices:

### Environment Variables

- **Never commit** `.env` files to version control
- Use **strong, randomly generated secrets** for `JWT_SECRET`, `JWT_REFRESH_SECRET` and `INTEGRATIONS_ENCRYPTION_KEY`:
  ```bash
  openssl rand -base64 32
  ```
- In production the backend refuses to start without `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET` and `INTEGRATIONS_ENCRYPTION_KEY`
- Change default secrets before deploying to production
- Rotate secrets periodically

### Database Security

- Use strong passwords for database users
- Restrict database access to trusted networks only (Compose binds PostgreSQL and Redis to `127.0.0.1`)
- Enable SSL/TLS for database connections in production
- Regularly backup your database

### API Security

- Always use HTTPS in production — the auth cookies are `Secure` there
- Set `CORS_ORIGINS` (or `FRONTEND_URL`) to exactly the origins that serve the frontend; the backend refuses to start in production without one
- If the frontend and the API sit on different registrable domains, set `AUTH_COOKIE_SAMESITE=none` (HTTPS only)
- Behind a reverse proxy, forward `X-Forwarded-For` and `X-Forwarded-Proto`: the backend trusts one proxy hop, and rate limits are counted per client IP
- Set `METRICS_AUTH_TOKEN` if you scrape `/api/v1/metrics` — without it the endpoint refuses every request in production
- Keep token lifetimes short (`JWT_EXPIRES_IN` defaults to 30 minutes)

### Docker Security

- The published backend and frontend images run as the non-root `app` user; keep it that way in custom images
- Keep base images updated
- Scan images for vulnerabilities regularly (CI and CD run Trivy)
- Use Docker secrets for sensitive data in production

### Dependencies

- Regularly update dependencies to patch known vulnerabilities
- Dependabot is configured; CI also runs npm audit, secret scanning, Trivy and license checks

### Access Control

- Follow the principle of least privilege
- Use role-based access control (RBAC) properly
- Enable two-factor authentication, at least for owner and admin accounts
- Regularly audit user permissions

## Known Security Considerations

### Sessions and Tokens

- Browsers authenticate with HttpOnly cookies (`access_token`, `refresh_token`); login and refresh responses do not return the tokens in the body
- Access tokens expire after 30 minutes and refresh tokens after 30 days by default; a refresh token is rotated on every use
- Cookies default to `SameSite=lax`, so OAuth callback redirects keep the session. They are `Secure` in production or whenever `SameSite=none`
- Cookie-authenticated `POST`/`PUT`/`PATCH`/`DELETE` requests need the double-submit CSRF token: the readable `csrf_token` cookie echoed in the `x-csrf-token` header. Requests authenticated with `Authorization` or `X-Api-Key` are exempt
- Logging out of all devices and resetting a password invalidate every existing session
- Password reset tokens are single-use, valid for 1 hour and stored only as an HMAC (`PASSWORD_RESET_TOKEN_SECRET`, falling back to `JWT_SECRET`). The endpoint answers the same way for unknown addresses
- An email change takes effect only after the link sent to the new address (valid for 24 hours) is opened
- Passwords are hashed with bcrypt (`BCRYPT_ROUNDS`, default 12)
- Always use strong, unique secrets for JWT signing

### HTTP Hardening

- helmet sets security headers, including a Content-Security-Policy
- A global rate limit (500 requests per minute, stored in Redis when `REDIS_URL` is set) plus tighter limits on login, registration and password reset
- Swagger UI is not served when `NODE_ENV=production`

### File Uploads

- Uploads are limited to 10 MB and checked against a MIME allowlist and the file's signature bytes (CSV has no signature to check)
- Uploaded files are not served from a public directory; only custom field icons are served statically

### Outbound Requests

- Requests to user-supplied URLs (webhooks, S3/WebDAV/IMAP integrations) go through an egress guard that rejects private and loopback addresses, including after DNS resolution
- The optional geocoder and tile server are reached by the backend on the internal network only; the tile server needs no public port
- No external LLM is ever contacted: statement parsing and categorization are deterministic

### Open Protocol Integrations

- SMTP, IMAP, S3-compatible, WebDAV credentials and Telegram bot tokens must be stored encrypted
- New user-facing integrations must be configurable through the UI; env-only integration credentials are fallback-only
- Do not add closed SaaS SDKs for new integration work; prefer OSS libraries and open protocols
- Integration credentials should be scoped to dedicated service accounts or buckets
- Legacy OAuth tokens remain migration-compatible and should be removed after migration

## Security Updates

We will announce security updates through:

- GitHub Security Advisories
- Release notes
- GitHub Releases page

Subscribe to repository notifications to stay informed.

## Vulnerability Disclosure Timeline

We follow responsible disclosure practices:

1. **Day 0**: Vulnerability reported
2. **Day 2**: Initial acknowledgment to reporter
3. **Day 7**: Assessment completed and severity determined
4. **Day 30**: Fix developed and tested (for critical issues)
5. **Day 90**: Public disclosure (or earlier if agreed with reporter)

## Bug Bounty Program

We currently do not have a bug bounty program, but we deeply appreciate security researchers who help us keep Seneca secure. We will:

- Credit you in our security advisories (with your permission)
- Thank you in our release notes
- List you in our contributors

## Contact

For security-related questions that are not vulnerabilities, you can:

- Open a GitHub Discussion in the Security category
- Contact the maintainers through GitHub

## Additional Resources

- [OWASP Top Ten](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Docker Security](https://docs.docker.com/engine/security/)

---

Thank you for helping keep Seneca and our users safe!
