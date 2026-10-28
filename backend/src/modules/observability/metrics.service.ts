import { Injectable } from '@nestjs/common';
import { Counter, collectDefaultMetrics, Gauge, Histogram, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();

  readonly httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'] as const,
    registers: [this.registry],
  });

  readonly httpRequestDurationSeconds = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });

  readonly statementParsingDurationSeconds = new Histogram({
    name: 'statement_parsing_duration_seconds',
    help: 'Statement parsing duration in seconds by stage',
    labelNames: ['stage', 'bank', 'file_type', 'result'] as const,
    buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 20, 40, 60, 120],
    registers: [this.registry],
  });

  readonly statementParsingErrorsTotal = new Counter({
    name: 'statement_parsing_errors_total',
    help: 'Total parsing errors by stage and reason',
    labelNames: ['stage', 'error'] as const,
    registers: [this.registry],
  });

  /** Reasons are a closed list of codes (statement-validation.helper), so labels stay few. */
  readonly statementParseOutcomeTotal = new Counter({
    name: 'statement_parse_outcome_total',
    help: 'Parsed statements by bank, parser, outcome and the reason each was held for review',
    labelNames: ['bank', 'parser', 'outcome', 'reason'] as const,
    registers: [this.registry],
  });

  readonly storageFileAccessDurationSeconds = new Histogram({
    name: 'storage_file_access_duration_seconds',
    help: 'Storage file access duration (preview/download)',
    labelNames: ['action', 'source', 'result'] as const,
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });

  readonly storageFileAccessErrorsTotal = new Counter({
    name: 'storage_file_access_errors_total',
    help: 'Storage file access errors by action and reason',
    labelNames: ['action', 'reason'] as const,
    registers: [this.registry],
  });

  // --- Database pool metrics ---

  readonly dbPoolActiveConnections = new Gauge({
    name: 'db_pool_active_connections',
    help: 'Number of active database connections',
    registers: [this.registry],
  });

  readonly dbPoolIdleConnections = new Gauge({
    name: 'db_pool_idle_connections',
    help: 'Number of idle database connections',
    registers: [this.registry],
  });

  readonly dbPoolWaitingQueries = new Gauge({
    name: 'db_pool_waiting_queries',
    help: 'Number of queries waiting for a connection',
    registers: [this.registry],
  });

  readonly dbQueryDurationSeconds = new Histogram({
    name: 'db_query_duration_seconds',
    help: 'Database query duration in seconds',
    labelNames: ['operation'] as const,
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [this.registry],
  });

  // --- Redis / cache metrics ---

  readonly redisCommandsTotal = new Counter({
    name: 'redis_commands_total',
    help: 'Total Redis commands by command and result',
    labelNames: ['command', 'result'] as const,
    registers: [this.registry],
  });

  readonly redisCommandDurationSeconds = new Histogram({
    name: 'redis_command_duration_seconds',
    help: 'Redis command duration in seconds',
    labelNames: ['command'] as const,
    buckets: [0.0005, 0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry });
  }

  contentType(): string {
    return this.registry.contentType;
  }

  async metrics(): Promise<string> {
    return this.registry.metrics();
  }
}
