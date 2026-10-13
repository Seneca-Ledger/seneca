import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { type AppErrorBody, isAppErrorBody } from '../errors/app-error';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import { RequestContext } from '../observability/request-context';

type MessageWithDetails = {
  message?: unknown;
};

const isMessageWithDetails = (value: unknown): value is MessageWithDetails =>
  typeof value === 'object' && value !== null && 'message' in value;

const sqlState = (exception: unknown): string | undefined => {
  if (!(exception instanceof QueryFailedError)) return undefined;
  const code: unknown = (exception.driverError as { code?: unknown } | undefined)?.code;
  return typeof code === 'string' ? code : undefined;
};

/**
 * What Postgres refused because of the request, not a server fault:
 * - class 22, "data exception": a number out of range, text too long, a
 *   malformed uuid or date — a 400;
 * - 23503 on a delete: other rows still use the record — a 409;
 * - 23503 on a write: it names a record that does not exist — a 400.
 */
function refusedByDatabase(exception: unknown): { status: number; message: string } | undefined {
  const code = sqlState(exception);
  if (code?.startsWith('22')) {
    return { status: HttpStatus.BAD_REQUEST, message: 'A value is out of range or malformed' };
  }
  if (code === '23503') {
    return /^update or delete on table/.test((exception as Error).message)
      ? { status: HttpStatus.CONFLICT, message: 'The record is still in use' }
      : { status: HttpStatus.BAD_REQUEST, message: 'It refers to a record that does not exist' };
  }
  return undefined;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<AuthenticatedRequest>();

    const refused = refusedByDatabase(exception);
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : (refused?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : (refused?.message ?? 'Internal server error');

    // Domain errors carry their own machine-readable code; the frontend
    // translates by that code and falls back to the English message below.
    const appError: AppErrorBody | undefined = isAppErrorBody(message) ? message : undefined;

    if (refused) {
      // Kept in the logs: a server-built value can trip it too.
      this.logger.warn(
        { type: 'refused_by_database', url: request.url, method: request.method },
        exception instanceof Error ? exception.message : undefined,
      );
    } else if (!(exception instanceof HttpException)) {
      // Debug log to surface unexpected errors in logs
      this.logger.error(
        { type: 'unhandled_exception', url: request.url, method: request.method },
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const errorResponse = {
      error: {
        code: appError?.code ?? this.getErrorCode(status),
        message: appError?.message ?? this.extractMessage(status, message),
        params: appError?.params,
        details: appError
          ? this.extraFields(message)
          : isMessageWithDetails(message) && message.message
            ? message
            : undefined,
      },
      requestId: RequestContext.getRequestId(),
      traceId: RequestContext.getTraceId(),
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(errorResponse);
  }

  private getErrorCode(status: number): string {
    const codes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      422: 'VALIDATION_ERROR',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
    };
    return codes[status] || 'UNKNOWN_ERROR';
  }

  /**
   * Payload a domain error carries beyond the code/message/params contract,
   * e.g. `duplicateStatementId` on a statement-upload conflict.
   */
  private extraFields(body: unknown): Record<string, unknown> | undefined {
    if (typeof body !== 'object' || body === null) {
      return undefined;
    }
    const rest = Object.fromEntries(
      Object.entries(body as Record<string, unknown>).filter(
        ([key]) => key !== 'code' && key !== 'message' && key !== 'params',
      ),
    );
    return Object.keys(rest).length > 0 ? rest : undefined;
  }

  /**
   * Messages are English by construction — clients localise by `error.code`.
   */
  private extractMessage(status: number, rawMessage: unknown): string {
    const defaultByStatus: Record<number, string> = {
      400: 'Bad request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not found',
      422: 'Validation error',
      429: 'Too many requests',
      500: 'Internal server error',
    };

    const extracted =
      typeof rawMessage === 'string'
        ? rawMessage
        : ((isMessageWithDetails(rawMessage) ? rawMessage.message : undefined) ??
          defaultByStatus[status] ??
          'Error');

    // class-validator returns an array of constraint violations
    if (Array.isArray(extracted)) {
      return defaultByStatus[status] ?? 'Error';
    }

    if (typeof extracted === 'string' && extracted) {
      return extracted;
    }

    return defaultByStatus[status] ?? 'Error';
  }
}
