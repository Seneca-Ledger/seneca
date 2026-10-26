import { HttpException, type HttpStatus } from '@nestjs/common';
import { Data } from 'effect';
import { appError, type ErrorCode } from '../errors/app-error';

/**
 * The typed counterpart of `throw new XxxException(appError(code))`: an Effect
 * fails with it, and EffectRuntime turns it into the same HTTP response.
 */
export class DomainError extends Data.TaggedError('DomainError')<{
  readonly status: HttpStatus;
  readonly code: ErrorCode;
  readonly params?: Record<string, string | number>;
  /** Extra payload for the client, e.g. the id of a conflicting record. */
  readonly details?: Record<string, unknown>;
}> {}

export const toHttpException = (error: DomainError): HttpException =>
  new HttpException({ ...appError(error.code, error.params), ...error.details }, error.status);
