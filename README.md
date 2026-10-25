<div align="center">
<img width="150" height="150" alt="Seneca logo" src="https://github.com/user-attachments/assets/eded65fe-0490-4ff8-bbe9-76f2a6711983" />

<h1>Seneca</h1>

<p align="center">
  :globe_with_meridians: <a href="https://github.com/symonbaikov/seneca/releases/latest">Download</a> · :book: <a href="https://symonbaikov.github.io/seneca/">Documentation</a>
</p>

[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge)](CONTRIBUTING.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9%20%7C%206.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Release](https://img.shields.io/github/v/release/symonbaikov/seneca?style=for-the-badge)](https://github.com/symonbaikov/seneca/releases/latest)

**Open-source financial data platform for importing, processing, and analyzing bank statements**


[Quick Start](#quick-start) • [Docs](https://symonbaikov.github.io/seneca/) • [Features](#features) • [Tech Stack](#tech-stack) • [Architecture](#architecture) • [Contributing](CONTRIBUTING.md)

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
[![GitHub Stars](https://img.shields.io/github/stars/symonbaikov/seneca?style=flat-square&logo=github)](https://github.com/symonbaikov/seneca/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/symonbaikov/seneca?style=flat-square&logo=github)](https://github.com/symonbaikov/seneca/network/members)
[![GitHub Issues](https://img.shields.io/github/issues/symonbaikov/seneca?style=flat-square&logo=github)](https://github.com/symonbaikov/seneca/issues)

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

Seneca's parsers are only as good as the statements they were tested on. **I'm looking for people willing to share bank statements** — any bank, any country, any format (PDF, CSV, XLSX, OFX, MT940, CAMT.053, a phone screenshot) — so I can write and test parsers for them.

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

## Why Seneca exists

Seneca turns unstructured financial documents (PDFs, CSVs, email receipts) into clean, queryable data. Most personal finance apps ask for your bank login or upload your statements to their servers; Seneca runs on your own machine or server, so your financial history stays with you. Open source and self-hosted — for a single person keeping private books as much as for a team that needs control over its financial data pipeline.

---

## Features

Seneca is a full-stack platform for importing, categorizing and analyzing bank statement data — on your own for personal finances, or together with a partner, an accountant or a team.

### Core capabilities

- **Multi-format Statement Import** — PDF, CSV, XLSX / XLS, DOCX, OFX / QFX, QIF, MT940, CAMT.053 and image files. Native PDF parsers for Kaspi Bank, Bereke Bank, and Bank Hapoalim / Isracard; CSV column presets for 22 banks and fintechs (Revolut, Wise, N26, Monzo, Chase, ING and others); a generic table parser for any other bank's PDF.
- **OCR for Image Statements** — Tesseract.js text extraction from scanned documents and photos.
- **Idempotent Uploads** — SHA-256 file hashing prevents duplicate imports.
- **Transaction Deduplication** — Fingerprint-based duplicate detection with confidence scoring, merge, and mark-as-duplicate workflows.
- **Categorization** — Rules first, then what the workspace already taught Seneca about a payee (payees with aliases, learned from your confirmations). Rows neither covers stay uncategorised for review; no external model is ever contacted.
- **Review Queue** — Every imported row waits in Review until a person confirms it; only confirmed rows count in reports, budgets and the ledger. Suspected duplicates have their own list.
- **Bank Sync (bring your own aggregator)** — Connect your own SimpleFIN Bridge account; new rows are pulled on demand or every six hours and go through the same import path as an uploaded file.
- **Multi-Tenant Workspaces** — Unlimited workspaces with invitation flows and per-workspace data isolation.
- **Granular RBAC** — Roles: owner, admin, member, viewer, and accountant (reads everything and can export the tax pack, DATEV and tax returns, but changes nothing). Per-user permission overrides.
- **Dashboard & Reports** — Cash flow, top categories, trends, custom report builder with CSV/XLSX export.
- **Audit Log** — Complete event trail with one-click rollback for supported operations.
- **Workspace Versions** — A snapshot of each workspace every night at 03:00 in the owner's time zone, plus any taken by hand; kept daily for 30 days, weekly for 26 weeks and monthly after that. Open one to see the app as it was that day, read-only, or save it as a new workspace.
- **Webhooks** — Outbound event delivery to subscribed endpoints with token-based authentication.
- **API Keys** — Programmatic access via `lum_`-prefixed, SHA-256 hashed keys with revocation support.
- **MCP** — AI agents (Claude Code, Claude Desktop, any MCP client) connect to `/api/v1/mcp` with an API key; tools follow the key's scopes and their writes are audited as the key.
- **Budgets** — Budget tracking with manual spend recording and alerts, plus a Stoic balance of planned versus actual spending across necessity, work, virtue and leisure.
- **Subscriptions** — Recurring billing detection and management with frequency-based tracking.
- **Goals & Net Worth** — Savings goals with progress tracking, and net worth aggregated across accounts, wallets, investments, precious metals and crypto holdings.
- **Forecast** — Cash-flow forecast from known paydays, bills, subscriptions and receivables, with safe-to-spend and runway.
- **Investments & Precious Metals** — Investment and retirement accounts with holdings and contributions; precious-metal lots valued by weight and purity.
- **Crypto Portfolio** — Crypto holdings with price and wallet sync across Ethereum, Base, Arbitrum, Optimism, Polygon, Tron, Bitcoin and Solana, and transfer mapping into transactions.
- **Search** — Global cross-entity search across the workspace.
- **Tax Engine** — VAT rates, rules, jurisdictions, thresholds, and VAT return generation; EU VAT numbers checked against VIES; reminders for upcoming VAT and income tax deadlines.
- **Tax Pack & DATEV** — One archive for your accountant with the year's tax-relevant rows and every receipt and invoice behind them; a DATEV Buchungsstapel export for businesses in Germany and Austria.
- **Double-Entry Ledger** — Every transaction is posted as a balanced journal entry into a chart of accounts built from your categories, bank accounts and wallets: VAT on its own account, other currencies converted into one base currency at the posting date, duplicates left out. Statement and wallet opening balances are booked against opening equity, and crypto transfers land on each crypto wallet's own account at the fiat value they were recorded at (not today's market value). Foreign-currency balances can be revalued at any day's rate, with the difference booked as FX gain or loss. Manual entries go through draft → post → reverse, and a posted entry can only be reversed, never edited. The database itself refuses an entry whose debits and credits differ. Trial balance, account ledger, profit and loss, and balance sheet are read straight from the journal, with each bank account reconciled against its latest statement. Opt in under Settings → Experimental.
- **Income Tax Declaration** — Year-end draft for the self-employed, built only from the category → form-line mappings you confirm: Germany Anlage EÜR, Spain Modelo 100 (estimación directa simplificada), Poland PIT-36L / PIT-28 / PIT-36, and a generic income and expense summary everywhere else. Checks data completeness, converts currencies with the official source where one is verified (NBP for Poland, Banca d'Italia for Italy), shows filing deadlines and portals for 25 EU countries, and exports PDF or XLSX.
- **Receipt Locations & Maps** — Every receipt can show where it was bought on a self-hosted map: a manual pin, the geocoded merchant address, the photo's GPS tag, or the device position.
- **Backups** — Scheduled encrypted backups with export, import, and restore.
- **Docker Ready** — One-command deployment with Docker Compose.

<details>
<summary><b>Extended modules</b></summary>

### Intelligence

- **Categorization Rules & Payee Memory** — Per-workspace categorization rules, plus payees (with aliases) that remember the category you confirmed for a merchant and apply it on future imports.
- **Insights & Advice** — Rule-based analyzers read your own numbers: things to do appear in one quiet strip on the dashboard, observations and Stoic advice on the Advice page; dismissible per user.
- **Generic PDF Parser** — reads transaction tables from any PDF when no native parser matches.

### Integrations

- **IMAP Receipts** — syncs chosen mailbox folders on demand, parses merchant/amount/tax/line-item data, links receipts to transactions.
- **S3-compatible Storage** — import and sync statement files with MinIO or another S3-compatible bucket.
- **WebDAV Storage** — import and sync statement files with Nextcloud or another WebDAV-compatible server.
- **Workbook Import** — export and import custom table data via XLSX, CSV, and ODS files.
- **Telegram Bot** — Connect a chat in one click; get scheduled financial reports in a chat or channel, type an expense (`coffee 4.50`), send a receipt photo (it lands in Review) or a PDF statement (it goes to import).
- **Peppol** — Send and receive e-invoices through your own access point account (Recommand).
- **Spreadsheet Import** — Import transactions, budgets, invoices, bills, subscriptions and metal lots from a spreadsheet, with column mapping suggested from the headers.
- **AI Assistant Plugin** — Ready-made prompts filled with your own figures (budgets, goals, subscriptions, forecast and more). Pressing one opens ChatGPT in a new tab with the prompt, or copies it when it is too long for a link; nothing leaves the browser until you press it. Like webhooks and MCP, it is a plugin each workspace switches on or off.

### Collaboration & Access Control

- **Auth Sessions** — List and manage active login sessions per device. Revoke individual sessions or all at once.
- **Account Security** — TOTP two-factor authentication with recovery codes, self-service password reset by email, and email changes that take effect only after the new address is confirmed.
- **Workspace Invitations** — Email invitation flow with token-based acceptance.

### Finance & Reporting

- **Balance Sheet** — Account-level balance tracking with historical snapshots and export.
- **Accounts Payable** — Pay-tab workflow for managing and tracking payable records. Marking a bill paid links the bank transaction that settled it (matching candidates are suggested) or records a cash payment from a wallet, so the payment reaches the ledger.
- **Invoicing** — Clients, itemized invoices with per-line tax rates, and server-generated PDFs. Sending an invoice assigns it a sequential number, opens a receivable that is chased and paid the same way as a bill, and (when the double-entry ledger is enabled) books the accrual entry straight away — Dr Accounts Receivable, Cr Revenue and VAT payable. Recurring invoices generate their next draft automatically. Credit notes, and structured e-invoices: XRechnung (CII), Peppol BIS 3.0 (UBL) and ZUGFeRD / Factur-X hybrid PDFs, both written and read.
- **Small-Business Pack** — Statement rows matched against open bills and receivables, ageing, duplicate-bill detection and emailed payment reminders.
- **Custom Tables** — User-defined data structures with typed columns, batch editing, and formula support.
- **Manual Data Entry** — Record cash expenses, income, and receipts manually with custom fields and file attachments.
- **Categories** — Hierarchical transaction categories with usage counts and enable/disable toggle.
- **Reference Data** — Tax rates, branches, and wallets for enriching transactions.
- **Exchange Rates** — Currency exchange rate tracking and management.

### Platform

- **File Storage** — Document store with folders, tags, versioning, per-file permissions, and expiring shared links.
- **In-App Notifications** — Real-time feed with per-category preferences and unread badge count.
- **Installable App (PWA)** — Web push notifications, an offline page, and manual entries made offline queued until the connection is back.
- **WebSocket Support** — Live updates via Socket.IO for notifications and import progress.
- **Observability** — Prometheus-format metrics endpoint (`/api/v1/metrics`), structured JSON logs, and correlation IDs — point your own collector at it.
- **Guided Onboarding** — Full-screen onboarding, a welcome window, hints on each page, a demo workspace to explore, an illustrated guide, a getting-started checklist on the dashboard and 7 interactive feature tours.
- **Command Palette & Shortcuts** — `Ctrl/⌘ K` opens the command palette from any page; `?` lists every keyboard shortcut.
- **Localization** — The UI ships in 35 languages via Intlayer; English is the default locale.
- **Content Background** — A bundled or uploaded photo behind the app content, with adjustable dimming.

</details>

---

## What Seneca is NOT

Setting expectations upfront:

- **Not a bank integration** — Seneca holds no bank integration of its own: it parses statement files you export from your bank. If you have your own account with an aggregator that speaks an open protocol (SimpleFIN Bridge today), you can connect it under Integrations and Seneca pulls your statements through the same import; Seneca itself never talks to a bank.
- **Not an accrual accounting suite** — The ledger records what your statements and manual entries say. There is no automatic accrual, depreciation schedule, or period-end closing workflow.
- **Not a filing service or tax adviser** — Seneca computes tax figures and drafts VAT and income tax documents, but it does not submit anything to a tax authority on your behalf. An income tax draft is not tax advice — check it before you file.
- **Not a replacement for accounting software** — Seneca keeps double-entry books of your bank activity and issues invoices, but it does not run payroll or file statutory reports. Use it next to QuickBooks, Xero, or 1C rather than instead of them.

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

## Tech Stack

### Backend

| Layer | Technology |
|---|---|
| Framework | [NestJS 11](https://nestjs.com/) |
| Language | TypeScript 6 (strict) |
| Database | [PostgreSQL 14](https://www.postgresql.org/) via [TypeORM 0.3](https://typeorm.io/) |
| Cache | [Redis 7](https://redis.io/) via `cache-manager` |
| Auth | JWT in HttpOnly cookies (access 30 min / refresh 30 d), double-submit CSRF, TOTP 2FA, Passport.js, bcrypt |
| File Processing | pdfplumber (Python), pdf-parse, pdf-lib, tesseract.js v5, sharp, xlsx, exifr |
| Documents | pdfmake (invoices, reports), XRechnung / Peppol UBL / ZUGFeRD writers |
| Email | SMTP via nodemailer + React Email templates |
| Real-time | Socket.IO 4 + @nestjs/websockets; web push (VAPID) |
| Scheduling | @nestjs/schedule (cron jobs for Telegram reports, backups, crypto and bank sync, tax deadline reminders) |
| Queues | BullMQ on Redis (statement parsing) |
| Hardening | helmet, @nestjs/throttler with Redis storage |
| Maps (optional) | tileserver-gl + Nominatim, self-hosted and proxied by the backend |
| Metrics | prom-client (Prometheus) |
| Validation | class-validator + class-transformer (DTOs); Effect 4 Schema for shared API contracts (`packages/contracts`) and decoded external calls |
| API Docs | Swagger / OpenAPI at `/api/docs` |
| Linter | [Biome](https://biomejs.dev/) |

### Frontend

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| Runtime | React 19 |
| Language | TypeScript 5.9 (strict) |
| Styling | MUI v7 + Emotion |
| Icons | MUI Icons |
| Tables | TanStack Table v9 + TanStack Virtual v3 |
| Charts | Recharts v3 (cash flow, net worth, categories, ROI) + ECharts v6 (goal Sankey, forecasts, statements) |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| Data Fetching | TanStack Query v5 + Axios v1 (cookie credentials), responses typed by the shared Effect contracts |
| Real-time | socket.io-client v4 |
| i18n | Intlayer v7 + next-intlayer (35 locales) |
| Maps | Leaflet 1.9 |
| Date pickers | MUI X Date Pickers v9 |
| Offline / PWA | Service worker (`public/sw.js`), IndexedDB queue for offline entries |
| Onboarding | driver.js |
| PDF Viewer | react-pdf v10 |
| Animation | framer-motion v12 |
| Compiler | React Compiler (babel-plugin-react-compiler) |
| Linting | Biome |
| Tests | Vitest v4 |

### Infrastructure

| Layer | Technology |
|---|---|
| Containerization | Docker + Docker Compose |
| CI/CD | GitHub Actions (CI, CD, CodeQL, dependency-review, Scorecard, release-please, changelog, Makefile check, docs) |
| Supply chain | Trivy scans, Conftest policies, cosign signatures, SPDX SBOM attestations |
| Maps stack (optional) | Planetiler, tileserver-gl, Nominatim via Compose profiles |
| Docs site | Docusaurus (`website/`) |

---

## Repository Structure

```
seneca/
├── backend/                         # NestJS API server
│   ├── src/
│   │   ├── modules/                 # Feature modules
│   │   │   ├── api-keys/            # Programmatic API key management
│   │   │   ├── mcp/                 # MCP endpoint (/api/v1/mcp) for AI agents, behind API keys
│   │   │   ├── application-settings/ # Runtime system configuration
│   │   │   ├── auth/                # Cookie sessions, CSRF, 2FA, password reset
│   │   │   ├── users/               # User CRUD, avatars, backgrounds, email change, permissions
│   │   │   ├── workspaces/          # Multi-tenant workspaces, RBAC, invitations
│   │   │   ├── statements/          # Bank statement upload & lifecycle management
│   │   │   ├── transactions/        # Transaction CRUD, search, deduplication
│   │   │   ├── categories/          # Hierarchical category management
│   │   │   ├── classification/      # Categorization rules, payee history
│   │   │   ├── payees/              # Payees, aliases and the categories learned for them
│   │   │   ├── review-inbox/        # Review queue: unconfirmed rows and suspected duplicates
│   │   │   ├── bank-sync/           # Bank sync through the user's own aggregator (SimpleFIN)
│   │   │   ├── entity-imports/      # Spreadsheet import into transactions, budgets, invoices, bills…
│   │   │   ├── parsing/             # Multi-format file parsers (Kaspi, Bereke, Hapoalim, CSV, OFX, QIF, MT940, CAMT, generic PDF)
│   │   │   ├── dashboard/           # Dashboard stats, trends, cash flow
│   │   │   ├── reports/             # Financial reports, export (CSV/XLSX)
│   │   │   ├── balance/             # Balance sheet accounts & snapshots
│   │   │   ├── ledger/              # Double-entry chart of accounts, journal, posting worker, reports
│   │   │   ├── budgets/             # Budget tracking & alerts
│   │   │   ├── storage/             # File storage, versioning, shared links
│   │   │   ├── exchange-rates/      # Currency exchange rate management
│   │   │   ├── telegram/            # Telegram bot, scheduled reports
│   │   │   ├── custom-tables/       # User-defined data structures
│   │   │   ├── data-entry/          # Manual expense/income entry
│   │   │   ├── notifications/       # In-app notifications & preferences
│   │   │   ├── push/                # Web push subscriptions (VAPID)
│   │   │   ├── view-preferences/    # Per-user remembered page state
│   │   │   ├── vendor-icons/        # Merchant logos
│   │   │   ├── notes/               # Notes on statements and receipts
│   │   │   ├── insights/            # Rule-based financial insights
│   │   │   ├── audit/               # Audit log with rollback
│   │   │   ├── import/              # Import session tracking
│   │   │   ├── branches/            # Branch reference data
│   │   │   ├── wallets/             # Wallet reference data
│   │   │   ├── tax/                 # VAT rates, rules, jurisdictions, VAT returns
│   │   │   ├── tax-pack/            # Year archive for the accountant (rows + receipts + invoices)
│   │   │   ├── tax-reminders/       # Upcoming VAT / income tax deadlines and reminders
│   │   │   ├── datev/               # DATEV Buchungsstapel export (DE/AT)
│   │   │   ├── reference-data/      # VIES VAT check, EU VAT rates (TEDB), public holidays
│   │   │   ├── income-tax/          # Income tax declaration drafts, rule packs, FX sources
│   │   │   ├── payables/            # Accounts payable workflow
│   │   │   ├── invoices/            # Invoicing: clients, invoices, credit notes, PDF, recurrence
│   │   │   ├── e-invoices/          # XRechnung, Peppol UBL, ZUGFeRD / Factur-X read & write
│   │   │   ├── peppol/              # Peppol sending/receiving via the workspace's access point
│   │   │   ├── smb/                 # Bill/receivable matching, ageing, payment reminders
│   │   │   ├── business-profile/    # Seller details and logo for issued documents
│   │   │   ├── receipts/            # Receipt management, browser, locations
│   │   │   ├── maps/                # Proxy to the self-hosted tile server
│   │   │   ├── geocoding/           # Nominatim client for merchant addresses
│   │   │   ├── subscriptions/       # Recurring billing detection & management
│   │   │   ├── webhooks/            # Outbound event delivery to endpoints
│   │   │   ├── open-protocol-integrations/ # S3, WebDAV, IMAP protocol handlers
│   │   │   ├── search/              # Global cross-entity search
│   │   │   ├── crypto/              # Crypto holdings, price and wallet sync
│   │   │   ├── goals/               # Savings / financial goals
│   │   │   ├── net-worth/           # Net worth aggregation across accounts
│   │   │   ├── investments/         # Investment accounts, holdings, precious metals
│   │   │   ├── forecast/            # Cash-flow forecast, safe-to-spend, runway
│   │   │   ├── backups/             # Encrypted scheduled backups, export & restore
│   │   │   ├── versions/            # Workspace versions: nightly snapshots, read-only open, save as copy
│   │   │   ├── system-update/       # In-app update requests for the optional updater
│   │   │   ├── mailer/              # Transactional email delivery
│   │   │   └── observability/       # Prometheus metrics endpoint
│   │   ├── entities/                # TypeORM entities
│   │   ├── common/                  # Guards, decorators, interceptors, filters
│   │   ├── config/                  # App configuration
│   │   └── migrations/              # Database migrations (auto-applied on startup)
│   ├── scripts/                     # Admin, seed, parse debug, storage repair, statement anonymizer
│   ├── golden/                      # Anonymized parser golden fixtures (golden-private/ is git-ignored)
│   └── @tests/                      # Unit and E2E test suites
├── frontend/                        # Next.js application
│   ├── app/
│   │   ├── (auth)/                  # Login, register, password reset, email verification
│   │   ├── (onboarding)/            # Onboarding flow
│   │   ├── (main)/                  # Protected app routes
│   │   │   ├── dashboard/           # Dashboard
│   │   │   ├── statements/          # Statement list, detail, reports sub-routes
│   │   │   ├── review/              # Review queue
│   │   │   ├── reports/             # Financial reports
│   │   │   ├── budgets/             # Budget tracking
│   │   │   ├── goals/               # Financial goals
│   │   │   ├── net-worth/           # Net worth overview
│   │   │   ├── forecast/            # Cash-flow forecast
│   │   │   ├── invoices/            # Invoices, clients, credit notes
│   │   │   ├── ledger/              # Double-entry ledger (experimental)
│   │   │   ├── crypto/              # Crypto portfolio
│   │   │   ├── subscriptions/       # Recurring billing
│   │   │   ├── roi/                 # ROI analysis
│   │   │   ├── advice/              # Advice from your own numbers
│   │   │   ├── custom-tables/       # Custom table UI
│   │   │   ├── workspaces/          # Workspace management
│   │   │   ├── supported-banks/     # Supported banks reference page
│   │   │   └── tax-declaration/     # Income tax declaration wizard
│   │   ├── categories/              # Category management
│   │   ├── integrations/            # Integration hub (S3, WebDAV, IMAP, bank sync, Peppol, workbook import)
│   │   ├── plugins/                 # AI assistant, MCP server, webhooks
│   │   ├── offline/                 # PWA offline page
│   │   ├── storage/                 # File storage browser
│   │   ├── settings/                # Profile, notifications, workspace, Telegram, versions
│   │   ├── audit/                   # Audit log viewer
│   │   ├── admin/                   # Admin dashboard & user management
│   │   ├── transactions/            # Transaction list & detail
│   │   ├── upload/                  # Statement upload flow
│   │   ├── components/              # Reusable React components
│   │   ├── hooks/                   # Custom hooks (useAuth, etc.)
│   │   └── tours/                   # driver.js guided tour definitions
│   └── public/                      # Static assets, bank logos, service worker
├── packages/
│   └── contracts/                   # Effect Schema API contracts (source; synced into backend and frontend)
├── docs/
│   ├── plans/                       # Feature design & implementation plans
│   ├── CI/                          # CI/CD pipeline documentation
│   ├── security/                    # CVE allowlists, license exceptions
│   └── statements-examples/         # Sample bank statement files for testing
├── infra/
│   └── maps/                        # Tile server assets and config for the `maps` profile
├── website/                         # Docusaurus documentation site
├── scripts/                         # Shell helper scripts
│   ├── generate-env.sh              # Generate .env files with random secrets
│   └── generate-changelog.mjs       # Changelog generation script
├── docker-compose.yml               # Production Docker config (4 services + optional maps, geocoder, updater)
├── docker-compose.dev.yml           # Development overrides with hot reload
└── Makefile                         # All development commands
```

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
git clone https://github.com/symonbaikov/seneca.git
cd seneca
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

CD publishes `ghcr.io/symonbaikov/seneca-backend` and `ghcr.io/symonbaikov/seneca-frontend` for every release. To start the production stack without building anything locally:

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

`APP_NAME` in the root `.env` (default `Seneca`) is the name people see: the UI and all its translations, page titles, e-mails, Telegram replies, PDF/DATEV/e-invoice metadata, and export file names created from then on. The backend reads it at startup; the frontend bakes it in at build time (`docker-compose.yml` passes it as `NEXT_PUBLIC_APP_NAME`), so restart the dev stack or rebuild the frontend image after changing it.

### Sessions, CORS and Metrics

Browsers authenticate with HttpOnly cookies, so the cookie and CORS settings have to match how you host Seneca:

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
<summary><b>Categorization & Generic PDF Parsing</b></summary>

Seneca never contacts an external AI model. Categories come from your rules first, then from payee history (a payee's default moves only when two of its three most recent confirmed rows agree); anything left stays uncategorised in Review. **Integrations → Local categorization** can install a Transformers.js embedding model on the server from an uploaded ZIP; remote model loading stays disabled. PDFs from banks without a native parser go through `GenericPdfParser`, which reads the transaction tables from the PDF text layer.
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
- `geocoder` runs Nominatim on the same extract. The first import takes from minutes for a small country to hours for a large one, and needs several GB of disk. Each start also imports `infra/nominatim/special-phrases.csv`, which lets Seneca suggest shops near the phone when a receipt was photographed without GPS.
- Without these variables the feature stays off: receipts still get a photo or device point, and the map says tiles are not configured.
</details>

<details>
<summary><b>Dependency Policy</b></summary>

Do not add closed SaaS SDKs for new integration work. Prefer OSS libraries that implement open protocols such as SMTP, IMAP, WebDAV, and S3-compatible object storage.
</details>

<details>
<summary><b>Telegram Bot</b></summary>

Get a token from [@BotFather](https://t.me/botfather) once per server. An instance admin saves it as the **shared server bot** in **Settings → Notifications → Telegram**; the token is stored encrypted, and `TELEGRAM_BOT_TOKEN` in `.env` does the same job if nothing is saved there. Every workspace uses the shared bot unless its owner saves a bot of the workspace's own in the same section. People in a workspace on the shared bot see no token form at all, and the dashboard's Getting started list gets a **Connect Telegram** step. Changing the shared bot means people connect again, because a chat only accepts messages from a bot it has started.

After that, each user presses **Connect** in the same section: Telegram opens the bot, they press **Start**, and the chat is connected to their account and the open workspace. The link carries a one-time code that is valid for 10 minutes, so nobody types a chat id.

The server receives the bot's messages by itself. When the app's public URL (`APP_URL`, or the public URL saved in the workspace) is `https://`, it registers a webhook at `<url>/api/v1/telegram/webhook/<bot id>`. Otherwise, for example on a home server behind NAT, it long-polls Telegram. Long polling expects one backend instance per bot. A webhook you set up by hand for `TELEGRAM_BOT_TOKEN` with `TELEGRAM_WEBHOOK_SECRET` at `/api/v1/telegram/webhook` is left as it is.
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

Creates `demo@seneca.dev` with password `demo123` and a sample workspace with demo transactions.

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

Seneca uses TypeORM migrations exclusively (`synchronize: false`). Migrations run automatically on every startup unless `RUN_MIGRATIONS=false` is set. The migrations cover the entire schema history.

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

## Architecture

<img width="594" height="1125" alt="architecture" src="https://github.com/user-attachments/assets/8fdad21b-a3ee-4557-b186-22cf013dac04" />


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
- TypeORM entities for every domain object (see `backend/src/entities/`)

### Parsing Pipeline

```
Upload request
  → SHA-256 hash check (idempotency)
  → ParserFactory (detects bank + file type)
      ├── BerekeNewParser    (Bereke Bank new format PDF)
      ├── BerekeOldParser    (Bereke Bank legacy PDF)
      ├── KaspiParser        (Kaspi Bank PDF)
      ├── HapoalimParser     (Bank Hapoalim / Isracard PDF)
      ├── GenericPdfParser   (generic PDF table extraction)
      ├── ExcelParser        (XLSX / XLS)
      ├── CsvParser          (CSV, with per-bank presets)
      ├── DocxParser         (DOCX tables)
      ├── OfxParser / QifParser
      ├── Mt940Parser / Camt053Parser
      └── OCR Pipeline       (Tesseract.js for images)
  → ImportSession created (status: processing)
  → Transactions persisted
  → Categorization (rules → payee history)
  → Deduplication (fingerprint check, within and across statements)
  → Review queue (rows count only once confirmed)
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

Seneca exposes what a monitoring stack needs and leaves the stack itself to you —
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

A third, `updater` (`COMPOSE_PROFILES=updater` in `.env`), lets an instance admin run the equivalent of `make upgrade` from Settings → Advanced. It drives Docker through the socket, which amounts to root on the host, so it is off by default.

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
| [symonbaikov.github.io/seneca](https://symonbaikov.github.io/seneca/) | Documentation site, built from `website/` |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute — workflow, code style, PR process |
| [SECURITY.md](SECURITY.md) | Security policy, vulnerability reporting, disclosure process |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Community guidelines |
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

The cash flow, net worth, category and ROI charts follow the chart design of [Aurum](https://github.com/ZProger/Aurum) by [ZProger](https://github.com/ZProger). They were reimplemented for Seneca; no Aurum source code is included (Aurum is licensed under PolyForm Noncommercial 1.0.0).

---

<div align="center">

**[back to top](#seneca)**

Made with care by the Seneca community

</div>
