---
title: Docker Deployment
description: Production deployment with Docker Compose
---

Seneca ships a production Docker Compose setup in the repository root. CD publishes signed backend and frontend
images to GHCR for every release tag.

## Configuration

Generate a root `.env` with fresh secrets:

```bash
npm run setup:env   # or: make setup
```

The generated file targets development, so review it before production. Compose refuses to start without:

- `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `INTEGRATIONS_ENCRYPTION_KEY`

Compose builds `DATABASE_URL` from the `POSTGRES_*` values. For a public deployment also set:

- `FRONTEND_URL` (defaults to `http://localhost:3000`) or `CORS_ORIGINS` to the public frontend origin — the
  backend refuses to start in production without an allowed origin
- `AUTH_COOKIE_SAMESITE=none` (HTTPS only) when the frontend and API sit on different registrable domains, and
  `AUTH_COOKIE_DOMAIN` to share cookies across subdomains
- `METRICS_AUTH_TOKEN` if you scrape `/api/v1/metrics`

## Start services

Run the published images:

```bash
docker compose pull
docker compose up -d
```

Pin a release with `IMAGE_TAG` in `.env`. `make start` builds the images locally instead
(`docker compose up -d --build`).

This starts:

- PostgreSQL 14
- Redis 7
- NestJS backend
- Next.js frontend

Migrations run automatically when the backend starts (`RUN_MIGRATIONS=true`). PostgreSQL and Redis publish their
ports on `127.0.0.1` only.

## Upgrading

```bash
make upgrade                    # newest release (or IMAGE_TAG from .env)
make upgrade VERSION=v1.2.0     # a specific release
```

`make upgrade` does four things:

1. Dumps the database to `backup_<timestamp>.sql` in the repository root.
2. Pulls the backend and frontend images from GHCR.
3. Recreates the containers.
4. Waits up to five minutes for `/api/v1/health/ready`.

The backend applies any pending migrations when it starts. Your volumes and `.env` are left as they are. Without
make, run the same two steps that `make upgrade` runs after the backup:

```bash
docker compose pull
docker compose up -d
```

To roll back, pin the previous tag with `make upgrade VERSION=<old tag>`. If the newer release has already migrated
the schema, also restore the backup into an empty database:

```bash
docker compose stop backend frontend
docker exec finflow-postgres sh -c 'dropdb -U "$POSTGRES_USER" "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
make db-restore file=backup_<timestamp>.sql
make upgrade VERSION=<old tag>
```

The `make upgrade VERSION=<old tag>` at the end takes a fresh backup of the restored database before it starts the
old release.

### Updating from Settings

Instance admins see the running version and the newest release under **Settings → Advanced → Changelog**. To install
a release from there, turn on the updater container once:

```bash
echo 'COMPOSE_PROFILES=updater' >> .env
docker compose up -d
```

**Update to vX.Y.Z** then runs the same steps as `make upgrade`: it backs up the database to `backup_<timestamp>.sql`,
pulls the images, recreates the backend and frontend and waits for the backend. The page follows the progress and
reloads once the new version answers. A failed step is reported with its error output and the backup's file name.

The updater mounts `/var/run/docker.sock`, which gives it root on the host. It publishes no port and only reads
release tags (`vX.Y.Z`) that the backend writes to a shared volume. Only users with the `admin` role who are signed
in to the app can ask for an update; API keys cannot. Leave the profile off if you prefer to update over SSH.

Releases that change `docker-compose.yml` or `infra/updater/updater.sh` still need a `git pull` on the server, as with
`make upgrade`.

## Optional: receipt maps

```bash
docker compose --profile maps --profile geocoder up -d
```

Then set `TILESERVER_URL=http://tileserver:8080` and `GEOCODER_URL=http://nominatim:8080` for the backend and
restart it. `MAP_PBF_URL` selects the OpenStreetMap extract. See [Receipt Maps](../guides/receipt-maps).

## Reverse proxy

Terminate HTTPS in front of the stack and forward `X-Forwarded-For` and `X-Forwarded-Proto`. The backend trusts one
proxy hop by default, so rate limits key on the real client IP.

That trust is only safe while the proxy is the way in. Compose publishes the API on `BACKEND_PORT` (3001) on all
interfaces, and a client that connects to it directly can send its own `X-Forwarded-For` and choose the IP the login
and password-reset limits count against. Either keep that port closed to everything but the proxy (firewall, or
`"127.0.0.1:${BACKEND_PORT:-3001}:3001"` in `docker-compose.yml` when the browser reaches the API through the proxy), or
set `TRUST_PROXY` to the proxy's networks instead of a hop count:

```bash
# proxy on this host or in the Docker network
TRUST_PROXY=loopback, linklocal, uniquelocal
# or: proxy elsewhere in a private network
TRUST_PROXY=10.0.0.0/8
```

Direct clients with a public address are then never believed. Have the proxy replace, not append to, a client's own
`X-Forwarded-For` (Caddy does this by default; in nginx use `proxy_set_header X-Forwarded-For $remote_addr`).

## Health checks

```bash
curl http://localhost:3001/api/v1/health         # liveness
curl http://localhost:3001/api/v1/health/ready   # also checks the database
```

The production backend and frontend images define Docker `HEALTHCHECK`s.

## Storage

Data lives in named volumes: `postgres_data`, `redis_data`, and `backend_uploads` (mounted at `/app/uploads`),
plus `map_data` and `nominatim_data` when the map profiles run. Back them up or map them to persistent storage.

## Logs

```bash
make logs
make logs-backend
```

Next: [CI/CD](ci-cd)
