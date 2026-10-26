import type { AxiosError } from 'axios';
import { getCachedIntlayer } from '@/app/lib/locale-packs';
import { DEFAULT_LOCALE, readLocaleFromCookie } from './locale';

export interface ApiErrorResponse {
  error?: {
    code?: string;
    message?: string;
    params?: Record<string, string | number>;
    details?: unknown;
  };
  message?: string;
}

/**
 * Resolves a user-facing message for an API failure.
 *
 * Backend domain errors carry a machine-readable `code` and an English
 * `message`. We translate by code when the dictionary knows it, and fall back
 * to the backend's English text otherwise — so an untranslated code degrades
 * to readable English rather than to a generic placeholder. Without a
 * `fallback`, an error with no text of its own reads `apiErrors.fallback`.
 */
export function getApiErrorMessage(error: unknown, fallback?: string): string {
  if (isAxiosError(error)) {
    const apiError = error.response?.data?.error;

    return (
      translateErrorCode(apiError?.code, apiError?.params) ??
      apiError?.message ??
      error.response?.data?.message ??
      error.message ??
      fallback ??
      genericMessage()
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback ?? genericMessage();
}

const genericMessage = (): string => translateErrorCode('fallback', undefined) ?? '';

/**
 * Dictionaries of backend error codes: apiErrors, then one per catalogue file in
 * backend/src/common/errors/codes (app/lib/api-errors/*.content.ts).
 */
const ERROR_DICTIONARIES = [
  'apiErrors',
  'apiErrorsCore',
  'apiErrorsAccounts',
  'apiErrorsDocuments',
  'apiErrorsAccounting',
  'apiErrorsIntegrations',
  'apiErrorsCustomTables',
] as const;

function translateErrorCode(
  code: string | undefined,
  params: Record<string, string | number> | undefined,
): string | undefined {
  if (!code) {
    return undefined;
  }

  try {
    const locale = readLocaleFromCookie() ?? DEFAULT_LOCALE;
    const raw = ERROR_DICTIONARIES.map(key => {
      const dictionary = getCachedIntlayer(key as never, locale as never) as Record<
        string,
        { value?: unknown } | string | undefined
      >;
      const entry = dictionary[code];
      return typeof entry === 'string' ? entry : entry?.value;
    }).find(value => typeof value === 'string');
    // A missing dictionary yields a path-stringifying Proxy, not undefined —
    // only a genuine string may win over the backend's English message.
    const template = typeof raw === 'string' ? raw : undefined;

    return template && params ? interpolate(template, params) : template;
  } catch {
    // An unknown key or a dictionary that failed to load must not mask the
    // original error — fall through to the backend's English message.
    return undefined;
  }
}

const interpolate = (template: string, params: Record<string, string | number>): string =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(params[key] ?? ''));

export function getApiErrorStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined;
}

/** A write refused because the open workspace is a past version, which can only be viewed. */
export function isVersionReadOnlyError(error: unknown): boolean {
  return (
    isAxiosError(error) &&
    error.response?.status === 403 &&
    error.response.data?.error?.code === 'VERSION_READ_ONLY'
  );
}

function isAxiosError(error: unknown): error is AxiosError<ApiErrorResponse> {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isAxiosError' in error &&
    (error as AxiosError).isAxiosError === true
  );
}
