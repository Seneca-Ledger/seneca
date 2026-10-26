import { ACCOUNTING_ERRORS } from './codes/accounting';
import { ACCOUNTS_ERRORS } from './codes/accounts';
import { CORE_ERRORS } from './codes/core';
import { CUSTOM_TABLES_ERRORS } from './codes/custom-tables';
import { DOCUMENTS_ERRORS } from './codes/documents';
import { INTEGRATIONS_ERRORS } from './codes/integrations';

/**
 * Catalogue of domain error codes and their English messages.
 *
 * The English text here is the wire-level fallback: the frontend translates by
 * `code` when it knows one, and renders `message` verbatim when it does not.
 * Never localise these strings on the backend — see HttpExceptionFilter.
 */
export const ERR = {
  ...CUSTOM_TABLES_ERRORS,
  ...CORE_ERRORS,
  ...ACCOUNTING_ERRORS,
  ...DOCUMENTS_ERRORS,
  ...ACCOUNTS_ERRORS,
  ...INTEGRATIONS_ERRORS,
} as const;

export type ErrorCode = keyof typeof ERR;

const interpolate = (template: string, params: Record<string, string | number>): string =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(params[key] ?? ''));

export type AppErrorBody = {
  code: ErrorCode;
  message: string;
  params?: Record<string, string | number>;
};

/**
 * Builds the body for a Nest HttpException so the global filter can emit a
 * machine-readable `code` alongside the English `message`.
 *
 * @example throw new NotFoundException(appError('TABLE_NOT_FOUND'))
 * @example throw new BadRequestException(appError('COLUMN_NOT_FOUND_NAMED', { column: key }))
 */
export const appError = (
  code: ErrorCode,
  params?: Record<string, string | number>,
): AppErrorBody => ({
  code,
  message: params ? interpolate(ERR[code], params) : ERR[code],
  ...(params ? { params } : {}),
});

export const isAppErrorBody = (value: unknown): value is AppErrorBody =>
  typeof value === 'object' &&
  value !== null &&
  'code' in value &&
  typeof (value as AppErrorBody).code === 'string' &&
  (value as AppErrorBody).code in ERR;
