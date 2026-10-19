---
title: Quick Start
description: Run Seneca locally with Docker in minutes
---

This guide gets you from zero to a running Seneca stack using Docker Compose.

## Prerequisites

- Docker Desktop or Docker Engine with Compose v2 (`docker compose`)
- Node.js 20+ — the bootstrap script runs on the host
- Make (optional: `npm run setup:dev:docker` does the same thing)

## Start the stack

```bash
make quick-dev
```

This runs `npm run setup:dev:docker`, which:

- Writes `.env`, `backend/.env` and `frontend/.env.local` with development defaults and generated
  secrets, keeping any values you already set
- Builds and starts PostgreSQL, Redis, the backend and the frontend with hot reload
- Waits for `GET /api/v1/health/ready`
- Seeds the demo user

Database migrations run automatically when the backend starts.

## Log in

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api/v1
- Swagger: http://localhost:3001/api/docs (not served when `NODE_ENV=production`)
- Demo credentials: `demo@seneca.dev` / `demo123`

PostgreSQL listens on `127.0.0.1:5434` and Redis on `127.0.0.1:6379`.

## Next steps

- Upload a statement from the Statements page
- Connect storage, mail or bank sync under **Integrations** — see [Integrations](../guides/integrations)
- Read [Configuration](configuration) before exposing Seneca beyond localhost

Next: [Local Development](local-development)
