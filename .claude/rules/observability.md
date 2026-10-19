---
paths:
  - "backend/**"
---

# Observability & Reliability Standards

## 1. Structured Logging
- **Standard Format**: Logs must be output in JSON format in production for easy parsing by log aggregators (ELK, Datadog).
- **Levels**: Use appropriate levels: `error`, `warn`, `info`, `debug`.
- **No PII in Logs**: Never log passwords, credit card numbers, or full PII.

## 2. Distributed Tracing
- **Correlation IDs**: A unique `request-id` or `correlation-id` must be generated for every incoming request and propagated to all services and logs.
- **Trace Context**: Use OpenTelemetry or similar standards to trace complex operations across distributed components.

## 3. Health Monitoring
- **Health Checks**: Implement `/health` and `/ready` endpoints for container orchestration (Docker health checks, Kubernetes).
- **Proactive Alerts**: Set up alerts for high error rates (5xx > 1%), high p99 latency, and database connection failures.

## 4. Metrics
- **Business Metrics**: Track key performance indicators like "Time to process statement", "Transaction success rate", and "User sign-up flow completion".
- **Technical Metrics**: CPU usage, Memory heap size, Event loop lag, Database pool size.
