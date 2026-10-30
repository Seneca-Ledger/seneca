<div align="center">
<img width="150" height="150" alt="N (6)" src="https://github.com/user-attachments/assets/05bf21c1-922b-4a95-8423-ab0964946029" />



<h1>Stoic Budget</h1>

<p align="center">
  :globe_with_meridians: <a href="https://github.com/stoic-budget/stoic-budget/releases/latest">Download</a> · :book: <a href="https://stoic-budget.github.io/stoic-budget/">Documentation</a>
</p>

[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge)](.github/CONTRIBUTING.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9%20%7C%206.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Release](https://img.shields.io/github/v/release/stoic-budget/stoic-budget?style=for-the-badge)](https://github.com/stoic-budget/stoic-budget/releases/latest)

**Open-source financial data platform for importing, processing, and analyzing bank statements**


[Quick Start](#quick-start) • [Docs](https://stoic-budget.github.io/stoic-budget/) • [Features](#features) • [Tech Stack](#tech-stack) • [Architecture](#architecture) • [Contributing](.github/CONTRIBUTING.md)

</div>

<div align="center">

<img width="1890" height="887" alt="Overview dashboard: month budgets, income, spending, net and savings rate, top categories and recent transactions" src="https://github.com/user-attachments/assets/2f7fec9e-83da-4ebd-b80d-c6f2c8ae3c46" />


<br /><br />

<table>
<tr>
<td width="50%"><img width="1892" height="886" alt="Documents list: receipts with merchant, category, amount and approval status" src="https://github.com/user-attachments/assets/256ae873-93b5-47e8-bdbc-eb2f53f0799e" />
</td>
<td width="50%"><img width="1889" height="888" alt="Crypto portfolio: balance chart, holdings with profit and connected Ethereum and Tron wallets" src="https://github.com/user-attachments/assets/6d1130c6-b33e-4326-ac12-1eaf7408230c" />
</td>
</tr>
<tr>
<td width="50%"><img width="1891" height="882" alt="Cash-flow forecast: runway, lowest point and shortfall over the next 90 days" src="https://github.com/user-attachments/assets/b655215b-989f-483d-91bc-72ac457658c9" />
</td>
<td width="50%"><img width="1887" height="884" alt="Custom table of invoices with typed columns, paid checkboxes and statuses" src="https://github.com/user-attachments/assets/746cca0a-4c0e-43c5-8003-10cf251d13b2" />
</td>
</tr>
<tr>
<td colspan="2" align="center"><img width="1893" height="886" alt="Budgets with the Stoic balance: planned versus actual spending across necessity, work, virtue and leisure" src="https://github.com/user-attachments/assets/6b834d00-8a9b-43e3-b144-fb1262696984" />

</td>
</tr>
</table>

</div>


---

[![Maintainability](https://qlty.sh/gh/symonbaikov/projects/seneca/maintainability.svg)](https://qlty.sh/gh/symonbaikov/projects/seneca)
[![Code Coverage](https://qlty.sh/gh/symonbaikov/projects/seneca/coverage.svg)](https://qlty.sh/gh/symonbaikov/projects/seneca)
[![GitHub Stars](https://img.shields.io/github/stars/stoic-budget/stoic-budget?style=flat-square&logo=github)](https://github.com/stoic-budget/stoic-budget/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/stoic-budget/stoic-budget?style=flat-square&logo=github)](https://github.com/stoic-budget/stoic-budget/network/members)
[![GitHub Issues](https://img.shields.io/github/issues/stoic-budget/stoic-budget?style=flat-square&logo=github)](https://github.com/stoic-budget/stoic-budget/issues)

---

> **TL;DR**
>
> - Upload bank statements (PDF / CSV / XLSX / OFX / QIF / MT940 / CAMT.053 / image) → auto-parse → deduplicate → categorize → review
> - Private by default: your data stays on your machine or server, no bank login required, and the server never sends your data to an external AI model
> - Workspaces for yourself, your household or your team — roles, private transactions, audit log and one-click rollback
> - Full stack running locally in one command: `npm run setup:dev`
>
> Built for people who want to understand their money without handing their bank data to someone else's cloud — and for freelancers, small businesses, accountants and developers who need the same control. Self-hosted, open source, no proprietary SaaS lock-in.

---

## 📢 Wanted: real bank statements for parser development

Stoic Budget's parsers are only as good as the statements they were tested on. **I'm looking for people willing to share bank statements** — any bank, any country, any format (PDF, CSV, XLSX, OFX, MT940, CAMT.053, a phone screenshot) — so I can write and test parsers for them.

- **Redact what you like.** Names, account numbers, addresses and counterparties can be blacked out or replaced; the parser needs the layout, the columns and the way dates and amounts are written, not your data. A statement with a handful of rows is enough.
- **Your files stay private.** They are used only to build and test the parser. The originals are never committed to this repository — test fixtures that land in the repo are anonymized first.
- **Even one statement helps**, especially from banks that are not yet in [Supported Banks](#supported-banks).

📧 Send them to **[peterbaikov12@proton.me](mailto:peterbaikov12@proton.me)** — please mention the bank, the country and how you exported the file.

---
<p align="center">
  <a href="https://bank.gov.ua/en/news/all/natsionalniy-bank-vidkriv-rahunok-dlya-gumanitarnoyi-dopomogi-ukrayintsyam-postrajdalim-vid-rosiyskoyi-agresiyi" target="_blank">
    <img
      src="https://upload.wikimedia.org/wikipedia/commons/4/49/Flag_of_Ukraine.svg"
      alt="Ukraine Flag"
      width="520"
      height="120"
    /><br/>
    <strong>Humanitarian Aid for Ukraine</strong><br/>
    Support humanitarian relief via the official National Bank of Ukraine account.
  </a>
</p>


---

## Why Stoic Budget exists

Stoic Budget turns unstructured financial documents (PDFs, CSVs, email receipts) into clean, queryable data. Most personal finance apps ask for your bank login or upload your statements to their servers; Stoic Budget runs on your own machine or server, so your financial history stays with you. Open source and self-hosted — for a single person keeping private books as much as for a team that needs control over its financial data pipeline.

---

## Features

Stoic Budget is a full-stack platform for importing, categorizing and analyzing bank statement data — on your own for personal finances, or together with a partner, an accountant or a team.

---

## What Stoic Budget is NOT

Setting expectations upfront:

- **Not a bank integration** — Stoic Budget holds no bank integration of its own: it parses statement files you export from your bank. If you hold your own account with a data provider (SimpleFIN Bridge for the US and Canada, Enable Banking for the EU/EEA), you can connect it under Integrations and Stoic Budget pulls your statements through the same import; Stoic Budget itself never talks to a bank and holds no provider contract. That arrangement is also the only one in which this is free: every provider's free tier covers the accounts the person who linked them can see, which is why a workspace may hold one connection per person. A wallet's feed can be moved to another provider without losing its history.
- **Not an accrual accounting suite** — The ledger records what your statements and manual entries say. There is no automatic accrual, depreciation schedule, or period-end closing workflow.
- **Not a filing service or tax adviser** — Stoic Budget computes tax figures and drafts VAT and income tax documents, but it does not submit anything to a tax authority on your behalf. An income tax draft is not tax advice — check it before you file.
- **Not a replacement for accounting software** — Stoic Budget keeps double-entry books of your bank activity and issues invoices, but it does not run payroll or file statutory reports. Use it next to QuickBooks, Xero, or 1C rather than instead of them.

---

## Supported Banks

| Bank | Format | Parser |
|---|---|---|
| 🇰🇿 Kaspi Bank | PDF | `KaspiParser` — native table extraction |
| 🇰🇿 Bereke Bank (new format) | PDF | `BerekeNewParser` — native |
| 🇰🇿 Bereke Bank (legacy format) | PDF | `BerekeOldParser` — native |
| 🇮🇱 Bank Hapoalim / Isracard | PDF | `HapoalimParser` — native (Hebrew) |
| 🌍 Revolut, Wise, PayPal | CSV | `CsvParser` — column presets per bank |
| 🇬🇧 Monzo, Starling, Santander UK, Barclays, HSBC, Lloyds | CSV | `CsvParser` — column presets per bank |
| 🇺🇸 Chase, Bank of America, Capital One, American Express, Wells Fargo | CSV | `CsvParser` — column presets per bank |
| 🇩🇪 N26, Sparkasse / DKB, Commerzbank | CSV | `CsvParser` — column presets per bank |
| 🇳🇱 ING, Rabobank | CSV | `CsvParser` — column presets per bank |
| 🇸🇪 🇩🇰 🇳🇴 🇫🇮 Nordea | CSV | `CsvParser` — column presets per bank |
| T-Bank (Tinkoff) | CSV | `CsvParser` — column presets per bank |
| 🌍 Any bank | CSV | `CsvParser` — generic delimiter detection |
| 🌍 Any bank | XLSX / XLS | `ExcelParser` — generic |
| 🌍 Any bank | DOCX | `DocxParser` — generic table extraction |
| 🌍 Any bank | OFX / QFX | `OfxParser` |
| 🌍 Any bank | QIF | `QifParser` |
| 🌍 Any bank | MT940 | `Mt940Parser` — SWIFT statement |
| 🌍 Any bank | CAMT.053 (XML) | `Camt053Parser` — ISO 20022 statement |
| 🌍 Any bank | PDF | `GenericPdfParser` — generic table extraction |
| 🌍 Any bank | Image (PNG / JPG) | OCR pipeline via Tesseract.js |

Your bank is missing or parses badly? See [Wanted: real bank statements](#-wanted-real-bank-statements-for-parser-development).

---

## Quick Start

### Prerequisites

Choose the startup mode that matches your machine:

| Mode | Command | Requirements | Best for |
|---|---|---|---|
| Interactive | `npm run setup:dev` | Node.js 22.18+; Docker optional depending on selected mode | First run; lets you choose a mode |
| Docker full-stack | `npm run setup:dev:docker` | Docker Desktop or Docker Engine with Compose | Fastest fresh-clone path |
| Local app + Docker infra | `npm run setup:dev:local` | Node.js 22.18+, npm, Docker Compose | Running backend/frontend on your host |
| Native no-Docker | `npm run setup:dev:native` | Node.js 22.18+, npm, local PostgreSQL, local Redis, `psql`, `redis-cli` | Contributors who do not want Docker |
| Env only | `npm run setup:env` | Node.js 22.18+ | Preparing `.env` files without starting services |

### One-command development startup

```bash
git clone https://github.com/stoic-budget/stoic-budget.git
cd stoic-budget
npm run setup:dev
```

`npm run setup:dev` asks which development mode you want, then prepares env files, starts PostgreSQL and Redis, runs database migrations, seeds a demo user, and starts the app. Ports `3000` (frontend) and `3001` (backend) must be free.

To skip the question, start a mode directly:

```bash
npm run setup:dev:docker  # Full Docker dev stack (recommended for a first run)
npm run setup:dev:local   # Local backend/frontend + Docker PostgreSQL/Redis
npm run setup:dev:native  # Local backend/frontend + local PostgreSQL/Redis, no Docker
npm run setup:env         # Only create or complete local env files
```

`make quick-dev` remains available as a compatibility alias for `npm run setup:dev:docker`.

Docker full-stack builds and runs PostgreSQL, Redis, backend, and frontend, waits for backend readiness, seeds the demo account, and prints the URLs and login credentials. Once it is up:

- **App:** http://localhost:3000 — other endpoints are listed under [Service URLs](#service-urls)
- **Demo login:** `demo@seneca.dev` / `demo123`

```bash
curl -sS http://localhost:3001/api/v1/health/ready
# {"status":"ok","checks":{"db":"ok"}}
```

To stop, run `docker compose -f docker-compose.yml -f docker-compose.dev.yml down` in Docker mode, or press `Ctrl + C` in the terminal running `npm run setup:dev:local`.

In Docker mode `node_modules` and the Next.js cache live in named volumes, so a restart does not re-copy dependencies and page compiles stay warm. When `package-lock.json` changes, the container refreshes its `node_modules` on the next start by itself. `make clean` drops those volumes for a from-scratch start.

Development env files are generated locally and ignored by git. Existing values are preserved; missing defaults are appended. For production and optional integrations, see [Configuration](#configuration).

What the bootstrap script handles:

- Detects `docker compose` vs `docker-compose`.
- Creates missing `.env`, `backend/.env`, and `frontend/.env.local` values without overwriting existing local values.
- Uses development defaults: PostgreSQL user/password/database `finflow`, PostgreSQL port `5434`, Redis port `6379`, and generated JWT/encryption secrets.
- Runs migrations and demo seed automatically.
- Prints actionable errors for missing Docker daemon, missing native tools, and occupied ports.

### Native Development Without Docker

Native mode does not use Docker. It expects local PostgreSQL and Redis to be installed and running, with `psql` and `redis-cli` available on `PATH`.

```bash
npm run setup:dev:native
```

The command prepares env files, creates the configured PostgreSQL role/database when your local Postgres user has permission, verifies Redis, installs missing npm dependencies, runs migrations, seeds the demo user, and starts backend/frontend in the foreground.

By default, generated development env points PostgreSQL to `localhost:5434` and Redis to `localhost:6379`. If your local PostgreSQL uses the standard port, set `POSTGRES_PORT=5432` in `.env` and update `backend/.env` `DATABASE_URL` before running native mode.

If native prerequisites are missing, the command stops before starting the app and reports the missing tool, for example `redis-cli`.

### Run prebuilt images (no local build)

CD publishes `ghcr.io/stoic-budget/stoic-budget-backend` and `ghcr.io/stoic-budget/stoic-budget-frontend` for every release. To start the production stack without building anything locally:

```bash
npm run setup:env
docker compose pull
docker compose up -d
```

`IMAGE_TAG` in `.env` pins a specific release (defaults to the newest one).

To update later, run `make upgrade`. It backs up the database, pulls the new images, restarts the stack, and lets the backend apply any migrations. Instance admins can also update from Settings → Advanced once `COMPOSE_PROFILES=updater` is in `.env`. See [Upgrading](website/docs/deployment/docker.md#upgrading).

---

## Service URLs

| Service | URL | Notes |
|---|---|---|
| Frontend | http://localhost:3000 | Next.js app |
| Backend API | http://localhost:3001/api/v1 | All REST endpoints |
| Swagger Docs | http://localhost:3001/api/docs | Interactive API explorer (not served when `NODE_ENV=production`) |
| Metrics | http://localhost:3001/api/v1/metrics | Prometheus-format metrics |

---

## Configuration

### Development Defaults

No manual environment setup is required for development. `npm run setup:dev` creates ignored local env files and preserves any values you already set.

| Setting | Default Value |
|---|---|
| `DATABASE_URL` | `postgresql://finflow:finflow@localhost:5434/finflow` |
| `POSTGRES_PORT` | `5434` |
| `REDIS_URL` | `redis://localhost:6379` |
| `REDIS_PORT` | `6379` |
| `PORT` | `3001` |
| `JWT_SECRET` | Generated local dev secret |
| `JWT_REFRESH_SECRET` | Generated local dev secret |
| `INTEGRATIONS_ENCRYPTION_KEY` | Generated local dev secret |
| `JWT_EXPIRES_IN` | `30m` (code default; not written to env files) |
| `JWT_REFRESH_EXPIRES_IN` | `30d` |

To override backend values, edit `backend/.env`. Frontend overrides go in `frontend/.env.local`.

### Production Required Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens |
| `INTEGRATIONS_ENCRYPTION_KEY` | Key that encrypts integration credentials at rest |
| `NEXT_PUBLIC_API_URL` | Backend API URL seen by the browser |

Generate secure secrets with:

```bash
openssl rand -base64 32
# or use the helper script which sets up all env files at once:
bash scripts/generate-env.sh
```

### Product Name

`APP_NAME` in the root `.env` (default `Stoic Budget`) is the name people see: the UI and all its translations, page titles, e-mails, Telegram replies, PDF/DATEV/e-invoice metadata, and export file names created from then on. The backend reads it at startup; the frontend bakes it in at build time (`docker-compose.yml` passes it as `NEXT_PUBLIC_APP_NAME`), so restart the dev stack or rebuild the frontend image after changing it.

### Sessions, CORS and Metrics

Browsers authenticate with HttpOnly cookies, so the cookie and CORS settings have to match how you host Stoic Budget:

| Variable | Default | When to set it |
|---|---|---|
| `CORS_ORIGINS` | `FRONTEND_URL` | Comma-separated origins allowed to make credentialed requests. In production this is the whole allowlist. |
| `AUTH_COOKIE_SAMESITE` | `lax` | `none` when the frontend and API sit on different registrable domains. It forces `Secure`, so HTTPS only. |
| `AUTH_COOKIE_DOMAIN` | unset | Share the cookies across subdomains, e.g. `.example.com`. |
| `JWT_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | `30m` / `30d` | Access and refresh token lifetimes; each cookie expires with its token. |
| `PASSWORD_RESET_TOKEN_SECRET` | `JWT_SECRET` | A separate HMAC key for password reset tokens. |
| `BCRYPT_ROUNDS` | `12` | Work factor for new password hashes (10–15). |
| `METRICS_AUTH_TOKEN` | unset | Required to read `/api/v1/metrics` in production. |

Scripts and other non-browser clients keep sending `Authorization: Bearer <token>` or `X-Api-Key: lum_…`; those requests are not subject to the CSRF check.

### Demo User

```bash
make seed-demo
```

Creates `demo@seneca.dev` with password `demo123` and a sample workspace with demo transactions.

### Create Admin User

```bash
# Using Makefile (works with Docker or locally)
make admin email=admin@example.com password=admin123 name="Admin User"

# Using Docker exec directly
docker exec -it seneca-backend npm run create-admin -- admin@example.com admin123 "Admin User"

# Local (no Docker)
cd backend && npm run create-admin -- admin@example.com admin123 "Admin User"
```

Admin users have access to the `/admin` dashboard with full user management and system stats.

---

## Development

### Makefile Reference

All common tasks are available via `make`. Run `make help` to see the full list with descriptions.

**Setup & Services**

```bash
npm run setup:dev      # Interactive one-command development startup (recommended entry point)
npm run setup:dev:docker # Non-interactive full Docker development startup
npm run setup:dev:local  # Non-interactive local app + Docker infra startup
npm run setup:dev:native # Non-interactive local app + local infra startup, no Docker
npm run setup:env      # Create or complete ignored local env files only
make quick-dev         # Compatibility alias for npm run setup:dev:docker
make setup             # Compatibility alias for npm run setup:env
make install           # Install npm dependencies locally (no Docker)
make dev               # Start all services in development mode (hot reload)
make start             # Start all services in production mode
make stop              # Stop all services
make restart           # Restart all services
make clean             # Stop services and remove all Docker volumes (incl. dev node_modules volumes)
make clean-build-cache # Prune unused Docker build cache
make reset             # clean + setup + start (full environment reset)
make ps                # Show running containers
make stats             # Show container CPU/memory usage
make health            # Check health of all services
```

**Logs**

```bash
make logs              # Tail logs from all services
make logs-backend      # Backend logs only
make logs-frontend     # Frontend logs only
make logs-db           # PostgreSQL logs
make logs-redis        # Redis logs
```

**Database**

```bash
make migrate                           # Run pending migrations (Docker)
make migrate-revert                    # Revert last applied migration
make migrate-generate name=MyMigration # Generate new migration after entity changes
make db-start                          # Start PostgreSQL + Redis only (for local dev)
make db-shell                          # Open psql shell
make db-backup                         # Dump database to .sql file
make db-restore file=backup.sql        # Restore database from backup
```

**Testing**

```bash
make test              # Run all tests (backend + frontend)
make test-backend      # Backend unit tests only
make test-frontend     # Frontend Vitest tests only
make test-watch        # Backend tests in watch mode
make test-cov          # Backend tests with coverage report
make test-e2e          # End-to-end tests
```

**Code Quality**

```bash
make lint              # Check lint: Biome in both apps (no auto-fix)
make lint-check        # Same check; auto-fix with npm --prefix <app> run lint:fix
make format            # Format code with Biome
make type-check        # TypeScript type checking
make build             # Build backend + frontend for production
make build-docker      # Build Docker images
```

**Utilities**

```bash
make shell-backend     # Open bash shell in backend container
make shell-frontend    # Open sh shell in frontend container
make shell-db          # Open bash shell in database container
make docs              # Open Swagger docs in browser
make seed-demo         # Create demo user with sample data
make admin email=X password=X name=X  # Create admin user
make update            # Update npm dependencies
```

### Database Migrations

Stoic Budget uses TypeORM migrations exclusively (`synchronize: false`). Migrations run automatically on every startup unless `RUN_MIGRATIONS=false` is set. The migrations cover the entire schema history.

```bash
# Apply all pending migrations (Docker)
make migrate

# Apply all pending migrations (local)
cd backend && npm run migration:run

# Generate a new migration after changing an entity
make migrate-generate name=AddTransactionMerchantColumn
# or locally:
cd backend && npm run migration:generate -- src/migrations/AddTransactionMerchantColumn

# Revert the last applied migration
make migrate-revert
```

### Parser Debugging Scripts

```bash
cd backend

# Debug parsing output for a specific file
npm run parse:debug -- /path/to/statement.pdf

# Dump raw PDF table structure (useful for new bank formats)
npm run parse:tables -- /path/to/statement.pdf

# Compare parsing output between two files
npm run parse:diff -- /path/to/old.pdf /path/to/new.pdf

# Verify storage integrity (check for orphaned files)
npm run storage:verify

# Repair storage (remove orphaned files)
npm run storage:repair
```

### Hot Reload

```bash
npm run setup:dev:docker
# uses:
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Source file changes automatically reload both backend (ts-node watch) and frontend (Next.js HMR).

### Startup Troubleshooting

- **Docker daemon unavailable:** start Docker Desktop or Docker Engine, then rerun `npm run setup:dev`. The bootstrap script checks daemon reachability before running Compose.
- **Docker Compose command not found:** install Docker Compose v2. The bootstrap script prefers `docker compose` and falls back to `docker-compose` when available.
- **No Docker wanted:** run `npm run setup:dev:native` with local PostgreSQL and Redis already running. The script checks `psql` and `redis-cli` before touching the app.
- **Port already in use:** free ports `3000` and `3001` for local app mode. For PostgreSQL or Redis conflicts, change `POSTGRES_PORT` or `REDIS_PORT` in `.env`.
- **Reset local Docker data:** run `make clean`, then rerun `npm run setup:dev`.

---

## Testing

### Backend Tests

```bash
cd backend

npm test               # All unit tests
npm run test:watch     # Watch mode
npm run test:cov       # With coverage report (goal: 80%+)
npm run test:e2e       # End-to-end tests
npm run test:golden    # Parser golden file tests (deterministic output verification)
npm run test:ci        # Unit + E2E (sequential, used in CI)
```

Coverage report is written to `backend/coverage/lcov-report/index.html`.

Test files live in `backend/@tests/unit/` (unit) and `backend/@tests/e2e/` (E2E), using the `*.spec.ts` naming convention.

### Frontend Tests

```bash
cd frontend

npm test               # Run all tests with Vitest
```

---

### Security Model

- Sessions live in HttpOnly cookies: access token (30 min) + refresh token (30 d), tracked per device in `AuthSession`; the login response body carries no token
- Refresh token rotation on every use; old tokens invalidated
- Double-submit CSRF protection for cookie-authenticated writes; header-authenticated clients (`Authorization`, `X-Api-Key`) are exempt
- Optional TOTP two-factor authentication with recovery codes
- Single-use password reset (1 h) and email change (24 h) tokens; the reset endpoint answers the same way for known and unknown addresses
- Bcrypt password hashing (12 rounds by default, `BCRYPT_ROUNDS`)
- helmet security headers, a CORS allowlist and Redis-backed rate limits
- Outbound requests to user-supplied URLs go through an egress guard that blocks private and loopback addresses
- RBAC enforced at controller level via guards — workspace roles enforced on every request
- Audit log covers all mutating operations with rollback support for critical changes
- CVE allowlists and license exceptions documented in `docs/security/`
- See [.github/SECURITY.md](.github/SECURITY.md) for the full security policy

### Code Conventions

- Controllers are thin — all business logic in Services
- DTOs with `class-validator` decorators for all inputs
- TypeORM migrations only — never `synchronize: true`
- `file_hash` (SHA-256) for idempotent file operations
- Structured JSON logging with correlation IDs
- All code comments and commit messages in English
- Biome formatter: 2 spaces, single quotes, semicolons, 100-char line width

---

## Documentation

| Document | Description |
|---|---|
| [stoic-budget.github.io/stoic-budget](https://stoic-budget.github.io/stoic-budget/) | Documentation site, built from `website/` |
| [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md) | How to contribute — workflow, code style, PR process |
| [.github/SECURITY.md](.github/SECURITY.md) | Security policy, vulnerability reporting, disclosure process |
| [.github/CODE_OF_CONDUCT.md](.github/CODE_OF_CONDUCT.md) | Community guidelines |
| [CHANGELOG.md](CHANGELOG.md) | Release history |
| [docs/ui-principles.md](docs/ui-principles.md) | UI stability principles the product follows |
| [website/docs/](website/docs/) | Documentation site: getting started, guides, architecture, API and deployment reference |
| [docs/plans/](docs/plans/) | Feature design and implementation plan documents |
| [docs/CI/](docs/CI/) | CI/CD pipeline documentation |
| [docs/security/](docs/security/) | CVE allowlists and license exceptions |

Interactive API documentation: http://localhost:3001/api/docs (when backend is running).

---

## Contributing

We welcome contributions from the community.

### Ways to Contribute

- **Report bugs** — use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml)
- **Suggest features** — use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.yml)
- **Improve documentation** — fix typos, clarify guides, add examples
- **Submit pull requests** — fix bugs, add features, write tests
- **Add bank parsers** — support new banks by implementing the parser interface or adding a CSV preset
- **Share a bank statement** — see [Wanted: real bank statements](#-wanted-real-bank-statements-for-parser-development)
- **Translate** — improve any of the 35 UI locales (`*.content.ts` dictionaries)

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make changes and write or update tests
4. Run `make lint` and `make test` — both must pass
5. Commit using [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   feat(statements): add CSV import support
   fix(auth): handle expired refresh token correctly
   docs: update quick-start instructions
   test(parsing): add golden tests for Bereke new format
   refactor(classification): extract learning rule application logic
   ```
6. Push and open a Pull Request against `main`

### Code Style

- TypeScript strict mode throughout
- [Biome](https://biomejs.dev/) for linting and formatting (2 spaces, single quotes, semicolons)
- Run `make lint` (and `make format` if needed) before committing
- Follow existing module patterns: thin controllers, logic in services, DTOs for all inputs

For detailed guidelines, see [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md).

---

## Community

- **GitHub Discussions** — ask questions, share ideas, get help
- **GitHub Issues** — report bugs or request features
- **Star this repo** — helps others discover the project

---

## Security

Security is a top priority. Please read [.github/SECURITY.md](.github/SECURITY.md) for supported versions, the vulnerability disclosure process, and security best practices.

**Found a security issue?** Report it privately through [GitHub Security Advisories](../../security/advisories/new), not in public issues.

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

Built on great open-source foundations:

[NestJS](https://nestjs.com/) · [Next.js](https://nextjs.org/) · [PostgreSQL](https://www.postgresql.org/) · [TypeORM](https://typeorm.io/) · [Redis](https://redis.io/) · [MUI](https://mui.com/) · [Emotion](https://emotion.sh/) · [TanStack Table](https://tanstack.com/table) · [ECharts](https://echarts.apache.org/) · [Recharts](https://recharts.org/) · [Tesseract.js](https://tesseract.projectnaptha.com/) · [Socket.IO](https://socket.io/) · [Intlayer](https://intlayer.org/) · [driver.js](https://driverjs.com/) · [Biome](https://biomejs.dev/) · and many more.

The cash flow, net worth, category and ROI charts follow the chart design of [Aurum](https://github.com/ZProger/Aurum) by [ZProger](https://github.com/ZProger). They were reimplemented for Stoic Budget; no Aurum source code is included (Aurum is licensed under PolyForm Noncommercial 1.0.0).

---

<div align="center">

**[back to top](#stoic-budget)**

Made with care by the Stoic Budget community

</div>
