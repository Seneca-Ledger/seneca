---
title: Makefile Commands
description: Full reference of developer commands
---

Run `make help` for the same list in your terminal. Docker targets use `docker compose` (v2) and the
`finflow-*` container names.

## Setup

- `make setup` - Initial setup: create env files and generate secrets
- `make install` - Install dependencies for local development

## Quick actions

- `make quick-dev` - Zero-config startup: dev containers + demo user (`npm run setup:dev:docker`)
- `make quick-start` - Legacy alias for `quick-dev`
- `make reset` - Run `clean`, `setup`, and `start`
- `make update` - Run `npm update` in backend and frontend

## Docker operations

- `make start` - Start all services in production mode; builds the images locally (`docker compose up -d --build`)
- `make dev` - Start all services in development mode with hot reload
- `make stop` - Stop all services
- `make restart` - Restart all services
- `make clean` - Stop services and remove volumes, including the dev `node_modules` volumes
- `make clean-build-cache` - Remove unused Docker build cache

To run the published images instead of building them, use `docker compose pull && docker compose up -d` and pin a
release with `IMAGE_TAG`.

## Logs

- `make logs` - Logs from all services
- `make logs-backend`, `make logs-frontend`, `make logs-db`, `make logs-redis` - Logs from one service

## Development (local)

- `make backend-dev` - Start the backend locally (`npm run start:dev`)
- `make frontend-dev` - Start the frontend locally (`npm run dev`)
- `make db-start` - Start only PostgreSQL and Redis (needs a root `.env`; run `make setup` first)

## Database

These run inside the running `finflow-backend` container. The production backend image ships without npm, so use
`migrate*` against the dev stack; in production, migrations run automatically on start.

- `make migrate` - Run database migrations
- `make migrate-revert` - Revert the last migration
- `make migrate-generate name=MigrationName` - Generate a new migration
- `make db-shell` - Open a PostgreSQL shell
- `make db-backup` - Dump the database to `backup_<timestamp>.sql`
- `make db-restore file=backup.sql` - Restore a dump

## User management

- `make admin email=admin@example.com password=admin123 name="Admin"` - Create an admin user
- `make seed-demo` - Create the demo user (`demo@seneca.dev` / `demo123`)

## Testing

- `make test` - Backend unit tests (Jest) and frontend tests (Vitest)
- `make test-backend` - Backend unit tests
- `make test-frontend` - Frontend tests
- `make test-watch` - Backend tests in watch mode
- `make test-cov` - Backend tests with coverage
- `make test-e2e` - Backend end-to-end tests (need PostgreSQL and Redis)

## Code quality

- `make lint` - Runs each app's `lint` script, which only checks (Biome in both apps).
  To auto-fix, run `npm --prefix backend run lint:fix` and `npm --prefix frontend run lint:fix`.
- `make lint-check` - Check linting without fixing
- `make format` - Format code with Biome
- `make type-check` - Backend build plus frontend `type-check`

## Build

- `make build` - Build backend and frontend for production
- `make build-docker` - Build Docker images

## Utilities

- `make shell-backend`, `make shell-frontend`, `make shell-db` - Open a shell in a container
- `make health` - Check the backend (`/api/v1/health`), frontend, PostgreSQL, and Redis
- `make ps` - Show running containers
- `make stats` - Show container resource usage
- `make docs` - Open the Swagger docs at `http://localhost:3001/api/docs`

For full details, inspect `Makefile` in the repository root.
