---
title: Database Architecture
description: Entities, migrations, and data safety
---

Stoic Budget uses PostgreSQL through TypeORM, with migration-driven schema changes and explicit entity definitions.

## Entity model

The backend defines 85 entities under `backend/src/entities`. Highlights, by table name:

- `statements`, `transactions`, `import_sessions`, `receipts` for ingestion
- `workspaces`, `workspace_members`, `users` for tenancy
- `auth_sessions`, `password_reset_tokens`, `email_change_tokens` for accounts and sessions
- `audit_events`, `notifications`, `report_history` for governance
- `income_tax_profiles`, `income_tax_line_mappings`, `income_tax_returns`, `income_tax_disclaimer_acceptances`
  for the income tax declaration
- `integration_tokens`, `user_ai_settings`, `idempotency_keys` for integrations and request safety

## Migrations

- 142 migrations stored under `backend/src/migrations`
- Schema changes are always migration-based (`synchronize: false`)
- Migrations run on backend start unless `RUN_MIGRATIONS=false`
- CI applies migrations twice to prove they are idempotent
- `npm run migration:run` takes a lock against concurrent runs; `npm --prefix backend run migration:run:dev` is
  the ts-node path for development

## Data safety patterns

- Every tenant-owned query filters by `workspaceId`
- SHA-256 file hashes prevent duplicate statement imports
- Idempotency keys (`idempotency_keys`) on statement upload and manual data entry endpoints
- Soft deletes (`deletedAt`) on a handful of entities, including statements

## Indexing and performance

Transaction-heavy tables include composite indices on workspace, date, and amount. Duplicate detection combines
file hashes with transaction fingerprints and fuzzy matching on date, amount, and text.

Next: [Parsing Pipeline](parsing-pipeline)
