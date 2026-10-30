---
title: Architecture Overview
description: Service topology and request flow
---

Stoic Budget runs as four services: a Next.js frontend, a NestJS API, PostgreSQL, and Redis. Two optional Docker Compose
profiles add self-hosted receipt maps: `maps` (`map-assets`, `map-tiles-init`, `tileserver`) and `geocoder`
(`nominatim`). Background work — the statement parsing queue and scheduled jobs — runs inside the backend
process; there are no separate worker services.

![Stoic Budget architecture diagram](/img/architecture.svg)

## Core services

1. **Frontend (Next.js)**
   - Web UI for uploads, dashboards, and configuration
   - Proxies API requests to the backend through a Next.js rewrite (`API_PROXY_TARGET`, `http://backend:3001` in
     Docker)

2. **Backend (NestJS)**
   - REST API at `/api/v1` and Socket.IO for real-time notifications
   - HttpOnly session cookies with double-submit CSRF protection, RBAC, audit logging
   - helmet security headers and Redis-backed rate limiting
   - BullMQ queue for statement parsing, `@nestjs/schedule` for cron jobs

3. **PostgreSQL**
   - 85 TypeORM entities and 142 migrations; schema changes only through migrations

4. **Redis**
   - BullMQ statement parsing queue
   - Application cache
   - Rate limit counters shared by every backend instance

5. **Maps (optional)**
   - tileserver-gl renders the tiles; the backend proxies them under `/api/v1/maps`, so the tile server needs no
     public port
   - Nominatim geocodes merchant addresses printed on receipts
   - See [Receipt Maps](../guides/receipt-maps)

## Request flow

1. Client uploads a statement file.
2. Backend computes a SHA-256 hash and checks for duplicate uploads.
3. The statement is queued and parsed in the background.
4. `ParserFactoryService` detects the bank and selects a bank-specific or generic parser; OCR handles images and
   scans.
5. A quality gate rates the result `ready`, `review`, or `blocked`.
6. An import session previews the transactions and flags conflicts with existing ones; committing the import
   resolves each conflict.
7. Categories are assigned from your rules, then payee history.

## Observability

The backend exposes Prometheus-format metrics at `GET /api/v1/metrics` (requires `METRICS_AUTH_TOKEN` in
production), health checks at `GET /api/v1/health` and `GET /api/v1/health/ready`, and structured JSON logs with
request and trace IDs. Stoic Budget does not ship a monitoring stack — point your own collector at the endpoint. See
[Observability](../guides/observability).

Next: [Backend Architecture](backend)
