import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { BankSyncAuthError, BankSyncTemporaryError } from './bank-sync-provider.interface';

/**
 * Turns the two provider failures into answers the user can act on.
 *
 * Keeping them apart is the point: a rejected credential means "link again",
 * while a rate limit or a connection the provider is still repairing means
 * "wait" — and telling someone to re-link in that case is how an afternoon gets
 * spent re-authorizing banks that were never broken.
 */
@Catch(BankSyncAuthError, BankSyncTemporaryError)
export class BankSyncErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(BankSyncErrorFilter.name);

  catch(exception: BankSyncAuthError | BankSyncTemporaryError, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<{ url?: string }>();
    const temporary = exception instanceof BankSyncTemporaryError;
    const status = temporary ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.BAD_REQUEST;

    this.logger.warn(`${request.url ?? 'bank-sync'}: ${exception.message}`);
    if (temporary && exception.retryAfterSeconds) {
      response.setHeader('Retry-After', String(exception.retryAfterSeconds));
    }
    response.status(status).json({
      error: {
        code: temporary ? 'BANK_SYNC_UNAVAILABLE' : 'BANK_SYNC_NEEDS_REAUTH',
        message: exception.message,
        details: {
          /** False means the credential is fine and the call is worth repeating later. */
          needsRelink: !temporary,
          ...(temporary && exception.retryAfterSeconds
            ? { retryAfterSeconds: exception.retryAfterSeconds }
            : {}),
        },
      },
      timestamp: new Date().toISOString(),
      path: request.url ?? null,
    });
  }
}
