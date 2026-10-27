---
title: Observability
description: Metrics, logs, and health checks
---

Stoic Budget exposes metrics, logs and health endpoints. Which collector, dashboards and alerting you run is
up to you — no monitoring stack ships with the repository.

## Metrics

`GET /api/v1/metrics` returns Prometheus text format. Protect it with `METRICS_AUTH_TOKEN`:

- When the token is set, requests must send `Authorization: Bearer <METRICS_AUTH_TOKEN>`.
- When it is unset, the endpoint is open outside production and returns 403 in production.

```yaml
# prometheus.yml
scrape_configs:
  - job_name: seneca
    metrics_path: /api/v1/metrics
    authorization:
      credentials: <METRICS_AUTH_TOKEN>
    static_configs:
      - targets: ['backend:3001']
```

Available metrics:

- HTTP: `http_requests_total`, `http_request_duration_seconds`
- Statement parsing: `statement_parsing_duration_seconds`, `statement_parsing_errors_total`,
  `ai_parsing_calls_total`
- Storage: `storage_file_access_duration_seconds`, `storage_file_access_errors_total`
- Database: `db_pool_active_connections`, `db_pool_idle_connections`, `db_pool_waiting_queries`,
  `db_query_duration_seconds`
- Redis: `redis_commands_total`, `redis_command_duration_seconds`

## Logs

The backend writes structured JSON logs to stdout. Request logs carry a `requestId` and `traceId`;
responses expose the same values in the `x-request-id` and `x-trace-id` headers, so a client error
can be matched to its log lines.

## Health checks

- `GET /api/v1/health` — liveness; answers without touching dependencies
- `GET /api/v1/health/ready` — readiness; checks the database and returns 503 when it is unreachable

The backend image's Docker health check calls `/api/v1/health`.

Next: [Architecture Overview](../architecture/overview)
