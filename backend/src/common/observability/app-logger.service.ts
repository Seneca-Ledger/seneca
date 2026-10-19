import * as os from 'node:os';
import type { LoggerService, LogLevel } from '@nestjs/common';
import { RequestContext } from './request-context';

type Level = 'error' | 'warn' | 'log' | 'debug' | 'verbose';
type LoggerMessage = Parameters<LoggerService['log']>[0];

const levelToSeverity: Record<Level, 'error' | 'warn' | 'info' | 'debug' | 'trace'> = {
  error: 'error',
  warn: 'warn',
  log: 'info',
  debug: 'debug',
  verbose: 'trace',
};

const levelPriority: Record<Level, number> = {
  error: 50,
  warn: 40,
  log: 30,
  debug: 20,
  verbose: 10,
};

const normalizeLogLevel = (value: string | undefined): Level => {
  const v = (value || '').toLowerCase();
  if (v === 'error' || v === 'warn' || v === 'debug' || v === 'verbose') {
    return v;
  }
  return 'log';
};

export class AppLogger implements LoggerService {
  private readonly serviceName = process.env.SERVICE_NAME || 'seneca-backend';
  private readonly host = os.hostname();
  private readonly minLevel = normalizeLogLevel(process.env.LOG_LEVEL);
  private logLevels?: LogLevel[];

  setLogLevels?(levels: LogLevel[]): void {
    this.logLevels = levels;
  }

  log(message: LoggerMessage, context?: string): void {
    this.write('log', message, context);
  }

  error(message: LoggerMessage, trace?: string, context?: string): void {
    this.write('error', message, context, trace);
  }

  warn(message: LoggerMessage, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: LoggerMessage, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: LoggerMessage, context?: string): void {
    this.write('verbose', message, context);
  }

  private shouldLog(level: Level): boolean {
    if (this.logLevels && !this.logLevels.includes(level)) {
      return false;
    }
    return levelPriority[level] >= levelPriority[this.minLevel];
  }

  private write(level: Level, message: LoggerMessage, context?: string, trace?: string): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const store = RequestContext.get();
    const base = {
      timestamp: new Date().toISOString(),
      level: levelToSeverity[level],
      service: this.serviceName,
      pid: process.pid,
      host: this.host,
      requestId: store?.requestId,
      traceId: store?.traceId,
      context,
    };

    let payload: Record<string, unknown>;
    if (message instanceof Error) {
      payload = { ...base, message: message.message, stack: message.stack };
    } else if (message && typeof message === 'object') {
      payload = { ...base, ...message };
    } else {
      payload = { ...base, message };
    }

    if (trace) {
      payload.trace = trace;
    }

    const line = JSON.stringify(payload);
    if (level === 'error') {
      // eslint-disable-next-line no-console
      console.error(line);
    } else {
      // eslint-disable-next-line no-console
      console.log(line);
    }
  }
}
