<div align="center">
<img width="1584" height="396" alt="White and Blue Simple Gradient Business Profile LinkedIn Banner" src="https://github.com/user-attachments/assets/2b23ef6c-2bd5-4e12-8223-b0df2c15d421" />



---
  
<p align="center">
  :globe_with_meridians:<a href="#quick-start">Download</a>
</p>
---

[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge)](CONTRIBUTING.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**Open-source financial data platform for importing, processing, and analyzing bank statements**


[Quick Start](#quick-start) • [Features](#features) • [Tech Stack](#tech-stack) • [Architecture](#architecture) • [Contributing](CONTRIBUTING.md)

</div>

<div align="center">

<img src="https://github.com/user-attachments/assets/818f6af4-13a8-45aa-b66a-e9ea97a16f52" alt="screenshot-2026-09-15_16-57-51" width="100%" />

<br /><br />

<table>
<tr>
<td width="50%"><img src="https://github.com/user-attachments/assets/fb81c17a-e181-4524-aacf-37251f9d3281" alt="screenshot-2026-09-15_16-58-01" /></td>
<td width="50%"><img src="https://github.com/user-attachments/assets/c10b025c-a4a6-4ab2-83f0-44d94418de82" alt="screenshot-2026-09-15_16-59-05" /></td>
</tr>
<tr>
<td width="50%"><img src="https://github.com/user-attachments/assets/2ba01cb1-e628-41d0-91c5-74e35dc6d0ec" alt="screenshot-2026-09-15_17-00-02" /></td>
<td width="50%"><img src="https://github.com/user-attachments/assets/ea7e9ab7-9731-4ee2-b9a6-7b97c6e4b80c" alt="screenshot-2026-09-15_17-00-18" /></td>
</tr>
<tr>
<td colspan="2" align="center"><img src="https://github.com/user-attachments/assets/92c1ede2-f6a0-4813-aea1-2136bb2bf7e3" alt="screenshot-2026-09-15_17-00-30" width="50%" /></td>
</tr>
</table>

</div>


---

[![Maintainability](https://qlty.sh/gh/symonbaikov/projects/lumio/maintainability.svg)](https://qlty.sh/gh/symonbaikov/projects/lumio)
[![Code Coverage](https://qlty.sh/gh/symonbaikov/projects/lumio/coverage.svg)](https://qlty.sh/gh/symonbaikov/projects/lumio)
[![GitHub Stars](https://img.shields.io/github/stars/symonbaikov/lumio?style=flat-square&logo=github)](https://github.com/symonbaikov/lumio/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/symonbaikov/lumio?style=flat-square&logo=github)](https://github.com/symonbaikov/lumio/network/members)
[![GitHub Issues](https://img.shields.io/github/issues/symonbaikov/lumio?style=flat-square&logo=github)](https://github.com/symonbaikov/lumio/issues)

---

> **TL;DR**
>
> - Upload bank statements (PDF / CSV / XLSX / image) → auto-parse → deduplicate → AI-categorize
> - Multi-tenant workspaces with RBAC, audit log, and one-click rollback
> - Full stack running locally in one command: `npm run setup:dev`
>
> Built for finance teams, accountants, and developers who need to process and analyze bank statement data without proprietary SaaS lock-in.

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

## Why Lumio exists

Lumio turns unstructured financial documents (PDFs, CSVs, email receipts) into clean, queryable data. Open-source, self-hosted, and built for teams that need control over their financial data pipeline.

---

## Features

Lumio is a full-stack financial operations platform built for teams that need to import, categorize, analyze, and collaborate on bank statement data.

### Core capabilities

- **Multi-format Statement Import** — PDF, CSV, XLSX, and image files. Native parsers for Kaspi Bank, Bereke Bank, and Bank Hapoalim / Isracard. Generic AI PDF parser for any other bank.
- **OCR for Image Statements** — Tesseract.js text extraction from scanned documents and photos.
- **Idempotent Uploads** — SHA-256 file hashing prevents duplicate imports.
- **Transaction Deduplication** — Fingerprint-based duplicate detection with confidence scoring, merge, and mark-as-duplicate workflows.
- **AI Auto-Categorization** — OpenAI-compatible local/provider endpoint with per-workspace learning rules.
- **Multi-Tenant Workspaces** — Unlimited workspaces with invitation flows and per-workspace data isolation.
- **Granular RBAC** — Roles: owner, admin, member, viewer. Per-user permission overrides.
- **Dashboard & Reports** — Cash flow, top categories, trends, custom report builder with CSV/XLSX export.
- **Audit Log** — Complete event trail with one-click rollback for supported operations.
- **Webhooks** — Outbound event delivery to subscribed endpoints with token-based authentication.
- **API Keys** — Programmatic access via `lum_`-prefixed, SHA-256 hashed keys with revocation support.
- **Budgets** — Budget tracking with manual spend recording and alerts.
- **Subscriptions** — Recurring billing detection and management with frequency-based tracking.
- **Goals & Net Worth** — Savings goals with progress tracking, and net worth aggregated across accounts, wallets, and crypto holdings.
- **Crypto Portfolio** — Crypto holdings with price and wallet sync, and transfer mapping into transactions.
- **AI Chat & Semantic Search** — Ask questions about your data; embeddings-backed transaction search plus a global cross-entity search.
- **Tax Engine** — VAT rates, rules, jurisdictions, thresholds, and VAT return generation.
- **Double-Entry Ledger** — Every transaction is posted as a balanced journal entry into a chart of accounts built from your categories, bank accounts and wallets: VAT on its own account, other currencies converted into one base currency at the posting date, duplicates left out. Statement and wallet opening balances are booked against opening equity, and crypto transfers land on each crypto wallet's own account at the fiat value they were recorded at (not today's market value). Foreign-currency balances can be revalued at any day's rate, with the difference booked as FX gain or loss. Manual entries go through draft → post → reverse, and a posted entry can only be reversed, never edited. The database itself refuses an entry whose debits and credits differ. Trial balance, account ledger, profit and loss, and balance sheet are read straight from the journal, with each bank account reconciled against its latest statement. Opt in under Settings → Experimental.
- **Income Tax Declaration** — Year-end draft for the self-employed, built only from the category → form-line mappings you confirm: Germany Anlage EÜR, Spain Modelo 100 (estimación directa simplificada), Poland PIT-36L / PIT-28 / PIT-36, and a generic income and expense summary everywhere else. Checks data completeness, converts currencies with the official source where one is verified (NBP for Poland, Banca d'Italia for Italy), shows filing deadlines and portals for 25 EU countries, and exports PDF or XLSX.
- **Receipt Locations & Maps** — Every receipt can show where it was bought on a self-hosted map: a manual pin, the geocoded merchant address, the photo's GPS tag, or the device position.
- **Backups** — Scheduled encrypted backups with export, import, and restore.
- **Docker Ready** — One-command deployment with Docker Compose.

<details>
<summary><b>Extended modules</b></summary>

### Intelligence

- **ML Categorization Rules** — `CategoryLearning` remembers per-workspace merchant→category patterns and applies them automatically on future imports.
- **AI Financial Insights** — Automatically generated insights surfaced on the dashboard; dismissible per-user.
- **Generic AI PDF Parser** — an OpenAI-compatible endpoint extracts structured transaction data from any PDF when no native parser matches.

### Integrations

- **IMAP Receipts** — mailbox polling pulls email receipts, parses merchant/amount/tax/line-item data, links receipts to transactions.
- **S3-compatible Storage** — import and sync statement files with MinIO or another S3-compatible bucket.
- **WebDAV Storage** — import and sync statement files with Nextcloud or another WebDAV-compatible server.
- **Workbook Import** — export and import custom table data via XLSX, CSV, and ODS files.
- **Telegram Bot** — Scheduled financial reports delivered to a Telegram chat or channel.

### Collaboration & Access Control

- **Auth Sessions** — List and manage active login sessions per device. Revoke individual sessions or all at once.
- **Account Security** — TOTP two-factor authentication with recovery codes, self-service password reset by email, and email changes that take effect only after the new address is confirmed.
- **Workspace Invitations** — Email invitation flow with token-based acceptance.

### Finance & Reporting

- **Balance Sheet** — Account-level balance tracking with historical snapshots and export.
- **Accounts Payable** — Pay-tab workflow for managing and tracking payable records. Marking a bill paid links the bank transaction that settled it (matching candidates are suggested) or records a cash payment from a wallet, so the payment reaches the ledger.
- **Invoicing** — Clients, itemized invoices with per-line tax rates, and server-generated PDFs. Sending an invoice assigns it a sequential number, opens a receivable that is chased and paid the same way as a bill, and (when the double-entry ledger is enabled) books the accrual entry straight away — Dr Accounts Receivable, Cr Revenue and VAT payable. Recurring invoices generate their next draft automatically.
- **Custom Tables** — User-defined data structures with typed columns, batch editing, and formula support.
- **Manual Data Entry** — Record cash expenses, income, and receipts manually with custom fields and file attachments.
- **Categories** — Hierarchical transaction categories with usage counts and enable/disable toggle.
- **Reference Data** — Tax rates, branches, and wallets for enriching transactions.
- **Exchange Rates** — Currency exchange rate tracking and management.

### Platform

- **File Storage** — Document store with folders, tags, versioning, per-file permissions, and expiring shared links.
- **In-App Notifications** — Real-time feed with per-category preferences and unread badge count.
- **WebSocket Support** — Live updates via Socket.IO for notifications and import progress.
- **Observability** — Prometheus-format metrics endpoint (`/api/v1/metrics`), structured JSON logs, and correlation IDs — point your own collector at it.
- **Guided Onboarding** — 9 interactive feature tours.
- **Localization** — The UI ships in 35 languages via Intlayer; English is the default locale.
- **Content Background** — A bundled or uploaded photo behind the app content, with adjustable dimming.

</details>

---

## What Lumio is NOT

Setting expectations upfront:

- **Not a bank integration** — Lumio holds no bank integration of its own: it parses statement files you export from your bank. If you have your own account with an aggregator that speaks an open protocol (SimpleFIN Bridge today), you can connect it under Integrations and Lumio pulls your statements through the same import; Lumio itself never talks to a bank.
- **Not an accrual accounting suite** — The ledger records what your statements and manual entries say. There is no automatic accrual, depreciation schedule, or period-end closing workflow.
- **Not a filing service or tax adviser** — Lumio computes tax figures and drafts VAT and income tax documents, but it does not submit anything to a tax authority on your behalf. An income tax draft is not tax advice — check it before you file.
- **Not a replacement for accounting software** — Lumio keeps double-entry books of your bank activity and issues invoices, but it does not run payroll or file statutory reports. Use it next to QuickBooks, Xero, or 1C rather than instead of them.

---

## Supported Banks

| Bank | Format | Parser |
|---|---|---|
| Kaspi Bank | PDF | `KaspiParser` — native table extraction |
| Bereke Bank (new format) | PDF | `BerekeNewParser` — native |
| Bereke Bank (legacy format) | PDF | `BerekeOldParser` — native |
| Bank Hapoalim / Isracard | PDF | `HapoalimParser` — native (Hebrew) |
| Any bank | CSV | `CsvParser` — generic delimiter detection |
| Any bank | XLSX / XLS | `ExcelParser` — generic |
| Any bank | DOCX | `DocxParser` — generic table extraction |
| Any bank | PDF | `GenericPdfParser` — AI-assisted via OpenAI-compatible endpoint |
| Any bank | Image (PNG / JPG) | OCR pipeline via Tesseract.js |

---

## Tech Stack

### Backend

| Layer | Technology |
|---|---|
| Framework | [NestJS 11](https://nestjs.com/) |
| Language | TypeScript 5 (strict) |
| Database | [PostgreSQL 14](https://www.postgresql.org/) via [TypeORM 0.3](https://typeorm.io/) |
| Cache | [Redis 7](https://redis.io/) via `cache-manager` |
| Auth | JWT in HttpOnly cookies (access 30 min / refresh 30 d), double-submit CSRF, TOTP 2FA, Passport.js, bcrypt |
| File Processing | pdfplumber (Python), pdf-parse, pdf-lib, tesseract.js v5, sharp, xlsx, exifr |
| AI / LLM | OpenAI-compatible HTTP endpoint (Ollama, LocalAI, vLLM) |
| Email | SMTP via nodemailer + React Email templates |
| Real-time | Socket.IO 4 + @nestjs/websockets |
| Scheduling | @nestjs/schedule (cron jobs for Telegram reports, backups, crypto sync) |
| Queues | BullMQ on Redis (statement parsing) |
| Hardening | helmet, @nestjs/throttler with Redis storage |
| Maps (optional) | tileserver-gl + Nominatim, self-hosted and proxied by the backend |
| Metrics | prom-client (Prometheus) |
| Validation | class-validator + class-transformer (DTOs) |
| API Docs | Swagger / OpenAPI at `/api/docs` |
| Linter | [Biome](https://biomejs.dev/) |

### Frontend

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| Runtime | React 19 |
| Language | TypeScript 5 |
| Styling | MUI v7 + Emotion |
| Icons | MUI Icons |
| Tables | TanStack Table v8 + TanStack Virtual v3 |
| Charts | Recharts v3 (cash flow, net worth, categories, ROI) + ECharts v6 (goal Sankey, forecasts, statements) |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| Data Fetching | TanStack Query v5 + Axios v1 (cookie credentials) |
| Real-time | socket.io-client v4 |
| i18n | Intlayer v7 + next-intlayer (35 locales) |
| Maps | Leaflet 1.9 |
| Onboarding | driver.js |
| PDF Viewer | react-pdf v10 |
| Animation | framer-motion v12 |
| Compiler | React Compiler (babel-plugin-react-compiler) |
| Linting | Biome + ESLint |
| Tests | Vitest v4 |

### Infrastructure

| Layer | Technology |
|---|---|
| Containerization | Docker + Docker Compose |
| CI/CD | GitHub Actions (CI, CD, CodeQL, dependency-review, Scorecard, release-please, docs) |
| Supply chain | Trivy scans, Conftest policies, cosign signatures, SPDX SBOM attestations |
| Maps stack (optional) | Planetiler, tileserver-gl, Nominatim via Compose profiles |
| Docs site | Docusaurus (`website/`) |

---

## Repository Structure

```
lumio/
├── backend/                         # NestJS API server
│   ├── src/
│   │   ├── modules/                 # 49 feature modules
│   │   │   ├── api-keys/            # Programmatic API key management
│   │   │   ├── application-settings/ # Runtime system configuration
│   │   │   ├── auth/                # Cookie sessions, CSRF, 2FA, password reset
│   │   │   ├── users/               # User CRUD, avatars, backgrounds, email change, permissions
│   │   │   ├── workspaces/          # Multi-tenant workspaces, RBAC, invitations
│   │   │   ├── statements/          # Bank statement upload & lifecycle management
│   │   │   ├── transactions/        # Transaction CRUD, search, deduplication
│   │   │   ├── categories/          # Hierarchical category management
│   │   │   ├── classification/      # AI auto-categorization + ML learning rules
│   │   │   ├── parsing/             # Multi-format file parsers (Kaspi, Bereke, Hapoalim, CSV, AI)
│   │   │   ├── dashboard/           # Dashboard stats, trends, cash flow
│   │   │   ├── reports/             # Financial reports, export (CSV/XLSX)
│   │   │   ├── balance/             # Balance sheet accounts & snapshots
│   │   │   ├── ledger/              # Double-entry chart of accounts, journal, posting worker, reports
│   │   │   ├── budgets/             # Budget tracking & alerts
│   │   │   ├── storage/             # File storage, versioning, shared links
│   │   │   ├── gmail/               # Legacy receipt sync & parsing
│   │   │   ├── google-drive/        # Legacy Drive migration compatibility
│   │   │   ├── dropbox/             # Legacy Dropbox migration compatibility
│   │   │   ├── exchange-rates/      # Currency exchange rate management
│   │   │   ├── telegram/            # Telegram bot, scheduled reports
│   │   │   ├── custom-tables/       # User-defined data structures
│   │   │   ├── data-entry/          # Manual expense/income entry
│   │   │   ├── notifications/       # In-app notifications & preferences
│   │   │   ├── notes/               # Notes on statements and receipts
│   │   │   ├── insights/            # AI-generated financial insights
│   │   │   ├── audit/               # Audit log with rollback
│   │   │   ├── import/              # Import session tracking
│   │   │   ├── branches/            # Branch reference data
│   │   │   ├── wallets/             # Wallet reference data
│   │   │   ├── tax/                 # VAT rates, rules, jurisdictions, VAT returns
│   │   │   ├── income-tax/          # Income tax declaration drafts, rule packs, FX sources
│   │   │   ├── payables/            # Accounts payable workflow
│   │   │   ├── invoices/            # Invoicing: clients, invoices, line items, PDF, recurrence
│   │   │   ├── receipts/            # Receipt management, browser, locations
│   │   │   ├── maps/                # Proxy to the self-hosted tile server
│   │   │   ├── geocoding/           # Nominatim client for merchant addresses
│   │   │   ├── subscriptions/       # Recurring billing detection & management
│   │   │   ├── webhooks/            # Outbound event delivery to endpoints
│   │   │   ├── open-protocol-integrations/ # S3, WebDAV, IMAP protocol handlers
│   │   │   ├── ai-analysis/         # AI chat, embeddings, semantic transaction search
│   │   │   ├── search/              # Global cross-entity search
│   │   │   ├── crypto/              # Crypto holdings, price and wallet sync
│   │   │   ├── goals/               # Savings / financial goals
│   │   │   ├── net-worth/           # Net worth aggregation across accounts
│   │   │   ├── backups/             # Encrypted scheduled backups, export & restore
│   │   │   ├── mailer/              # Transactional email delivery
│   │   │   └── observability/       # Prometheus metrics endpoint
│   │   ├── entities/                # 89 TypeORM entities
│   │   ├── common/                  # Guards, decorators, interceptors, filters
│   │   ├── config/                  # App configuration
│   │   └── migrations/              # 149 database migrations (auto-applied on startup)
│   ├── scripts/                     # Admin, seed, parse debug, storage repair
│   └── @tests/                      # Unit and E2E test suites
├── frontend/                        # Next.js application
│   ├── app/
│   │   ├── (auth)/                  # Login, register, password reset, email verification
│   │   ├── (onboarding)/            # Onboarding flow
│   │   ├── (main)/                  # Protected app routes
│   │   │   ├── dashboard/           # Dashboard
│   │   │   ├── statements/          # Statement list, detail, reports sub-routes
│   │   │   ├── reports/             # Financial reports
│   │   │   ├── budgets/             # Budget tracking
│   │   │   ├── goals/               # Financial goals
│   │   │   ├── net-worth/           # Net worth overview
│   │   │   ├── crypto/              # Crypto portfolio
│   │   │   ├── subscriptions/       # Recurring billing
│   │   │   ├── roi/                 # ROI analysis
│   │   │   ├── advice/              # AI advice
│   │   │   ├── ai-analysis/         # AI chat over your data
│   │   │   ├── custom-tables/       # Custom table UI
│   │   │   ├── workspaces/          # Workspace management
│   │   │   ├── supported-banks/     # Supported banks reference page
│   │   │   └── tax-declaration/     # Income tax declaration wizard
│   │   ├── categories/              # Category management
│   │   ├── chat/                    # AI chat UI
│   │   ├── integrations/            # Integration hub (S3, WebDAV, IMAP, workbook import)
│   │   ├── storage/                 # File storage browser
│   │   ├── settings/                # Profile, notifications, workspace, Telegram
│   │   ├── audit/                   # Audit log viewer
│   │   ├── admin/                   # Admin dashboard & user management
│   │   ├── transactions/            # Transaction list & detail
│   │   ├── upload/                  # Statement upload flow
│   │   ├── components/              # Reusable React components
│   │   ├── hooks/                   # Custom hooks (useAuth, etc.)
│   │   └── tours/                   # driver.js guided tour definitions
│   └── public/                      # Static assets, bank logos
├── docs/
│   ├── plans/                       # 35 feature design & implementation plans
│   ├── CI/                          # CI/CD pipeline documentation
│   ├── security/                    # CVE allowlists, license exceptions
│   └── statements-examples/         # Sample bank statement files for testing
├── infra/
│   └── maps/                        # Tile server assets and config for the `maps` profile
├── mcp-server/                      # Claude MCP server integration
├── website/                         # Docusaurus documentation site
├── scripts/                         # Shell helper scripts
│   ├── generate-env.sh              # Generate .env files with random secrets
│   └── generate-changelog.mjs       # Changelog generation script
├── docker-compose.yml               # Production Docker config (4 services + optional maps/geocoder)
├── docker-compose.dev.yml           # Development overrides with hot reload
└── Makefile                         # All development commands
```

---

## Quick Start

### Prerequisites

Choose the startup mode that matches your machine:

| Mode | Command | Requirements | Best for |
|---|---|---|---|
| Interactive | `npm run setup:dev` | Node.js 20+; Docker optional depending on selected mode | First run; lets you choose a mode |
| Docker full-stack | `npm run setup:dev:docker` | Docker Desktop or Docker Engine with Compose | Fastest fresh-clone path |
| Local app + Docker infra | `npm run setup:dev:local` | Node.js 20+, npm, Docker Compose | Running backend/frontend on your host |
| Native no-Docker | `npm run setup:dev:native` | Node.js 20+, npm, local PostgreSQL, local Redis, `psql`, `redis-cli` | Contributors who do not want Docker |
| Env only | `npm run setup:env` | Node.js 20+ | Preparing `.env` files without starting services |

### One-command development startup

```bash
git clone https://github.com/symonbaikov/lumio.git
cd lumio
npm run setup:dev
```

`npm run setup:dev` asks which development mode you want, then prepares env files, starts PostgreSQL and Redis, runs database migrations, seeds a demo user, and starts the app.

### Fast bootstrap checklist (new contributor flow)

1. Install Node.js 20+ and Docker (with Compose) before you start.
2. Ensure ports are free: `3000` (frontend), `3001` (backend).
3. Prepare environment files once:

```bash
npm run setup:env
```

4. Start using one of the non-interactive modes:

```bash
npm run setup:dev:docker  # full Docker stack (recommended for first run)
npm run setup:dev:local   # local app + Docker infra
```

5. Verify availability:

```bash
curl -sS http://localhost:3001/api/v1/health/ready
open http://localhost:3000
```

Expected output from step 5 health check:

```json
{"status":"ok","checks":{"db":"ok"}}
```

Default demo login is printed after startup in the terminal:

- **Email:** `demo@lumio.dev`
- **Password:** `demo123`

To stop Docker mode cleanly:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
```

In Docker mode `node_modules` and the Next.js cache live in named volumes, so a restart does not re-copy dependencies and page compiles stay warm. When `package-lock.json` changes, the container refreshes its `node_modules` on the next start by itself. `make clean` drops those volumes for a from-scratch start.

### Run prebuilt images (no local build)

CD publishes `ghcr.io/symonbaikov/lumio-backend` and `ghcr.io/symonbaikov/lumio-frontend` for every release. To start the production stack without building anything locally:

```bash
npm run setup:env
docker compose pull
docker compose up -d
```

`LUMIO_IMAGE_TAG` in `.env` pins a specific release (defaults to the newest one).

To stop local mode, press `Ctrl + C` in the terminal running `npm run setup:dev:local`.

For a new contributor, Docker full-stack is the recommended path. It builds and runs PostgreSQL, Redis, backend, and frontend, waits for backend readiness, seeds the demo account, and prints the URLs and login credentials.

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001/api/v1
- **Swagger Docs:** http://localhost:3001/api/docs

Demo credentials:
- **Email:** `demo@lumio.dev`
- **Password:** `demo123`

### Non-interactive startup

```bash
npm run setup:dev:docker  # Full Docker dev stack
npm run setup:dev:local   # Local backend/frontend + Docker PostgreSQL/Redis
npm run setup:dev:native  # Local backend/frontend + local PostgreSQL/Redis, no Docker
npm run setup:env         # Only create or complete local env files
```

`make quick-dev` remains available as a compatibility alias for `npm run setup:dev:docker`.

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

### Verified Startup Paths

The development bootstrap supports and tests these paths:

- `npm run setup:dev:docker` — full Docker stack, including backend readiness and demo seed.
- `npm run setup:dev:local` — local backend/frontend with Docker PostgreSQL and Redis.
- `npm run setup:dev:native` — local backend/frontend with local PostgreSQL and Redis; requires native database/cache tools installed first.

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

### Sessions, CORS and Metrics

Browsers authenticate with HttpOnly cookies, so the cookie and CORS settings have to match how you host Lumio:

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

### Optional Integrations

<details>
<summary><b>Open Protocol Storage & Mail</b></summary>

Use open protocols and self-hostable services for file sync and receipt import.

Configure S3-compatible storage, WebDAV storage, and IMAP inboxes from **Integrations**. Server env variables are only a temporary fallback for bootstrap or migration.

Endpoints and hosts saved in the UI must resolve to public addresses: the egress guard rejects private and loopback hosts when the settings are saved and again on every connection, so a MinIO or Nextcloud reachable only on your LAN or Docker network cannot be configured there.
</details>

<details>
<summary><b>AI Auto-Categorization & Generic PDF Parsing</b></summary>

Point Lumio at an OpenAI-compatible endpoint from **Integrations → AI-compatible endpoint**. Endpoints saved in the UI must resolve to a public address — the egress guard rejects private and loopback hosts. For a self-hosted model on your own network (Ollama on `localhost`, a LAN vLLM box), set `AI_BASE_URL` and `AI_MODEL` on the server instead; `AI_API_KEY` may be omitted when the endpoint needs no authentication.
</details>

<details>
<summary><b>Receipt Maps (self-hosted tiles & geocoding)</b></summary>

Receipt details end with a map of where the purchase was made. The point comes from, in order of trust: a pin the user placed, the merchant address printed on the receipt (geocoded), the GPS tag of the photo, or the phone's position when the receipt was shot with the in-app camera. Everything runs on your own infrastructure — no public map or geocoding service is called.

```bash
# Optional: the OSM extract for your region (defaults to Kazakhstan)
echo 'MAP_PBF_URL=https://download.geofabrik.de/europe/switzerland-latest.osm.pbf' >> .env
docker compose --profile maps --profile geocoder up -d
```

Then point the backend at the services and restart it:

```bash
TILESERVER_URL=http://tileserver:8080
GEOCODER_URL=http://nominatim:8080
```

- `maps` builds vector tiles from the extract with Planetiler and renders four styles — OSM Bright, Positron, Dark Matter and Basic — through tileserver-gl. The backend proxies the tiles, so the tile server never needs a public port. Users switch styles on the map in one click; the choice is saved to their profile.
- `geocoder` runs Nominatim on the same extract. The first import takes from minutes for a small country to hours for a large one, and needs several GB of disk. Each start also imports `infra/nominatim/special-phrases.csv`, which lets Lumio suggest shops near the phone when a receipt was photographed without GPS.
- Without these variables the feature stays off: receipts still get a photo or device point, and the map says tiles are not configured.
</details>

<details>
<summary><b>Dependency Policy</b></summary>

Do not add closed SaaS SDKs for new integration work. Prefer OSS libraries that implement open protocols such as SMTP, IMAP, WebDAV, S3-compatible object storage, and OpenAI-compatible local inference.
</details>

<details>
<summary><b>Telegram Bot</b></summary>

Get a token from [@BotFather](https://t.me/botfather), then save the bot token in **Settings → Telegram**. The token is stored encrypted; `TELEGRAM_BOT_TOKEN` is only a fallback server default.
</details>

<details>
<summary><b>Email (SMTP)</b></summary>

Used for workspace invitations, password reset links (valid for 1 hour) and email change confirmations (valid for 24 hours). Configure SMTP from **Integrations → SMTP email**. Without SMTP, invitation links are returned in the API response but no email is sent, and password reset and email change cannot complete — their links travel only by email. An SMTP host saved in the UI must resolve to a public address; a relay on your private network goes in `SMTP_HOST` / `SMTP_FROM` on the server instead.
</details>

---

## User Management

### Demo User

```bash
make seed-demo
```

Creates `demo@lumio.dev` with password `demo123` and a sample workspace with demo transactions.

### Create Admin User

```bash
# Using Makefile (works with Docker or locally)
make admin email=admin@example.com password=admin123 name="Admin User"

# Using Docker exec directly
docker exec -it finflow-backend npm run create-admin -- admin@example.com admin123 "Admin User"

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
make lint              # Check lint: backend Biome, frontend Biome + ESLint (no auto-fix)
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

Lumio uses TypeORM migrations exclusively (`synchronize: false`). Migrations run automatically on every startup unless `RUN_MIGRATIONS=false` is set. There are currently 149 migrations covering the entire schema history.

```bash
# Apply all pending migrations (Docker)
make migrate

# Apply all pending migrations (local)
cd backend && npm run migration:run

# Generate a new migration after changing an entity
make migrate-generate name=AddTransactionMerchantColumn
# or locally:
cd backend && npm run migration:generate -- AddTransactionMerchantColumn

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

# Clean up old Gmail receipt processing jobs
npm run cleanup:gmail-receipts
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

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser / Client                        │
└────────────┬────────────────────────────────────┬───────────────┘
             │                                    │
             │ HTTP/WebSocket                     │ HTTP
             │                                    │
┌────────────▼────────────┐         ┌────────────▼───────────────┐
│   Next.js Frontend      │         │   External Integrations     │
│   (Port 3000)           │         │  - SMTP / IMAP              │
│                         │         │  - S3-compatible storage    │
│  - App Router           │         │  - WebDAV storage           │
│  - React 19             │         │  - Workbook files           │
│  - MUI + Emotion        │         │  - Telegram Bot             │
│  - Real-time updates    │         │  - OpenAI-compatible AI     │
│                         │         │  - tileserver-gl, Nominatim │
└────────────┬────────────┘         └─────────────────────────────┘
             │
             │ REST API (/api/v1)
             │ WebSocket (Socket.IO)
             │
┌────────────▼─────────────────────────────────────────────────────┐
│              NestJS Backend (Port 3001)                          │
│                                                                  │
│  ┌─────────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Auth & RBAC    │  │   Parsing    │  │  Classification  │  │
│  │  - JWT + CSRF   │  │  - Kaspi     │  │  - AI Auto-Cat   │  │
│  │  - Sessions/2FA │  │  - Bereke    │  │  - ML Rules      │  │
│  │  - Permissions  │  │  - CSV/XLSX  │  │  - Learning      │  │
│  └─────────────────┘  │  - Generic   │  └──────────────────┘  │
│                       │  - OCR       │                          │
│  ┌─────────────────┐  └──────────────┘  ┌──────────────────┐  │
│  │  Transactions   │                    │   Workspaces     │  │
│  │  - CRUD         │  ┌──────────────┐  │  - Multi-tenant  │  │
│  │  - Dedup        │  │  Reports &   │  │  - Invitations   │  │
│  │  - Search       │  │  Dashboard   │  │  - RBAC          │  │
│  └─────────────────┘  │  - Cash flow │  └──────────────────┘  │
│                       │  - Export    │                          │
│  ┌─────────────────┐  └──────────────┘  ┌──────────────────┐  │
│  │  Audit Log      │                    │   Storage &      │  │
│  │  - Events       │  ┌──────────────┐  │   Files          │  │
│  │  - Rollback     │  │ Integrations │  │  - Versions      │  │
│  └─────────────────┘  │ - S3/WebDAV  │  │  - Shared links  │  │
│                       │ - IMAP       │  └──────────────────┘  │
│                       │ - Telegram   │                          │
│                       └──────────────┘                          │
└──────────┬────────────────────────────┬─────────────────────────┘
           │                            │
           │                            │
┌──────────▼────────────┐   ┌──────────▼────────────┐
│   PostgreSQL 14       │   │     Redis 7           │
│                       │   │                       │
│  - 89 TypeORM entities│   │  - Cache              │
│  - 149 migrations     │   │  - Rate limiting      │
│  - Full-text search   │   │  - BullMQ queues      │
└───────────────────────┘   └───────────────────────┘
```

### API Design

- All endpoints are prefixed `/api/v1`
- Global `JwtAuthGuard` — use `@Public()` decorator to opt out for public endpoints
- Global `ThrottlerGuard` — 500 req/min per client, counted in Redis when `REDIS_URL` is set; auth routes are tighter (login, register and reset-password 5/min, forgot-password 3/min)
- Global `CsrfGuard` — double-submit token (`csrf_token` cookie echoed in the `x-csrf-token` header) on cookie-authenticated writes; `@SkipCsrf()` exempts routes that start a session
- `helmet` security headers and a CORS allowlist (`CORS_ORIGINS`)
- `@RequirePermission()` + `PermissionsGuard` for fine-grained RBAC checks
- `@Audit()` decorator on mutating operations for automatic audit-log recording
- `@CurrentUser()` and `@WorkspaceId()` parameter decorators for clean controller code
- Structured JSON logging with per-request correlation IDs
- Global validation pipe with `class-validator` DTOs on all inputs
- Max upload size: 10 MB · pdfplumber timeout: 60 s (`PDF_PARSE_TIMEOUT_MS`) · Up to 5 files per statement upload · 5 statements parsed concurrently (`STATEMENT_PARSING_CONCURRENCY`)

### Database

- TypeORM with `synchronize: false` — schema changes only via numbered migrations
- Soft delete on statements via `deletedAt` timestamp
- SHA-256 `fileHash` on statements for idempotent re-upload detection
- `Idempotency-Key` header supported on upload endpoints (stored in `IdempotencyKey` entity)
- Transaction fingerprinting for cross-statement duplicate detection
- 89 TypeORM entities covering all domain objects (see `backend/src/entities/`)

### Parsing Pipeline

```
Upload request
  → SHA-256 hash check (idempotency)
  → ParserFactory (detects bank + file type)
      ├── BerekeNewParser    (Bereke Bank new format PDF)
      ├── BerekeOldParser    (Bereke Bank legacy PDF)
      ├── KaspiParser        (Kaspi Bank PDF)
      ├── HapoalimParser     (Bank Hapoalim / Isracard PDF)
      ├── GenericPdfParser   (AI-assisted: OpenAI-compatible endpoint)
      ├── ExcelParser        (XLSX / XLS)
      ├── CsvParser          (CSV)
      ├── DocxParser         (DOCX tables)
      └── OCR Pipeline       (Tesseract.js for images)
  → ImportSession created (status: processing)
  → Transactions persisted
  → ClassificationService (AI categorization + ML rules)
  → DeduplicationService (fingerprint check)
  → ImportSession status: complete
```

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
- See [SECURITY.md](SECURITY.md) for the full security policy

### Code Conventions

- Controllers are thin — all business logic in Services
- DTOs with `class-validator` decorators for all inputs
- TypeORM migrations only — never `synchronize: true`
- `file_hash` (SHA-256) for idempotent file operations
- Structured JSON logging with correlation IDs
- All code comments and commit messages in English
- Biome formatter: 2 spaces, single quotes, semicolons, 100-char line width

---

## Monitoring & Observability

Lumio exposes what a monitoring stack needs and leaves the stack itself to you —
which collector, dashboards and alerting you run is a self-hosting decision.

| What | Where | Notes |
|---|---|---|
| Metrics | `GET /api/v1/metrics` | Prometheus text format, via `prom-client` |
| Logs | stdout | Structured JSON in production, with a correlation ID per request |
| Health | `GET /api/v1/health`, `/health/ready` | For container health checks and orchestrators |

Guard the metrics endpoint with `METRICS_AUTH_TOKEN` — it answers only to a
matching `Authorization` header once that is set, and refuses all requests in
production while it is not.

---

## Deployment

### Docker Production

```bash
# Build and start all services
docker compose up -d --build

# Check service status
docker compose ps

# Tail logs
docker compose logs -f

# Stop everything
docker compose down
```

Docker Compose runs four services: `postgres` (PostgreSQL 14-alpine), `redis` (Redis 7-alpine), `backend` (NestJS), and `frontend` (Next.js). Data is persisted in named volumes (`postgres_data`, `redis_data`, `backend_uploads`).

Two optional profiles add the self-hosted receipt maps: `maps` (`map-assets`, `map-tiles-init`, `tileserver`) and `geocoder` (`nominatim`). See **Receipt Maps** under [Optional Integrations](#optional-integrations).

CD builds, scans, signs and publishes the images on version tags and stops there — where an instance runs is up to its operator.

### Environment-Specific Compose Files

| File | Purpose |
|---|---|
| `docker-compose.yml` | Production configuration |
| `docker-compose.dev.yml` | Development overrides (hot reload, source mounts) |

---

## Documentation

| Document | Description |
|---|---|
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute — workflow, code style, PR process |
| [SECURITY.md](SECURITY.md) | Security policy, vulnerability reporting, disclosure process |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Community guidelines |
| [CHANGELOG.md](CHANGELOG.md) | Release history |
| [docs/ROADMAP.md](docs/ROADMAP.md) | What is planned, in order |
| [docs/ui-principles.md](docs/ui-principles.md) | UI stability principles the product follows |
| [website/docs/](website/docs/) | Documentation site: getting started, guides, architecture, API and deployment reference |
| [docs/plans/](docs/plans/) | 35 feature design and implementation plan documents |
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
- **Add bank parsers** — support new banks by implementing the parser interface
- **Translate** — improve any of the 21 UI locales (`*.content.ts` dictionaries)

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

For detailed guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Community

- **GitHub Discussions** — ask questions, share ideas, get help
- **GitHub Issues** — report bugs or request features
- **Star this repo** — helps others discover the project

---

## Security

Security is a top priority. Please read [SECURITY.md](SECURITY.md) for supported versions, the vulnerability disclosure process, and security best practices.

**Found a security issue?** Report it privately through [GitHub Security Advisories](../../security/advisories/new), not in public issues.

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

Built on great open-source foundations:

[NestJS](https://nestjs.com/) · [Next.js](https://nextjs.org/) · [PostgreSQL](https://www.postgresql.org/) · [TypeORM](https://typeorm.io/) · [Redis](https://redis.io/) · [MUI](https://mui.com/) · [Emotion](https://emotion.sh/) · [TanStack Table](https://tanstack.com/table) · [ECharts](https://echarts.apache.org/) · [Recharts](https://recharts.org/) · [Tesseract.js](https://tesseract.projectnaptha.com/) · [Socket.IO](https://socket.io/) · [Intlayer](https://intlayer.org/) · [driver.js](https://driverjs.com/) · [Biome](https://biomejs.dev/) · and many more.

The cash flow, net worth, category and ROI charts follow the chart design of [Aurum](https://github.com/ZProger/Aurum) by [ZProger](https://github.com/ZProger). They were reimplemented for Lumio; no Aurum source code is included (Aurum is licensed under PolyForm Noncommercial 1.0.0).

---

<div align="center">

**[back to top](#lumio)**

Made with care by the Lumio community

</div>
