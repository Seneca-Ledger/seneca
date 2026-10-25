// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { getApiErrorMessage } from './api-error';
import documents from './api-errors/documents.content';
import apiErrors from './apiErrors.content';
import { LOCALE_COOKIE_NAME } from './locale';

const ru = (content: { content: unknown }, code: string): string =>
  (content.content as Record<string, { translation: Record<string, string> }>)[code].translation.ru;

const failure = (code: string, message: string) => ({
  isAxiosError: true,
  response: { status: 404, data: { error: { code, message } } },
});

describe('getApiErrorMessage', () => {
  afterEach(() => {
    document.cookie = `${LOCALE_COOKIE_NAME}=; max-age=0`;
  });

  it('translates a code from any error dictionary, not only apiErrors', () => {
    document.cookie = `${LOCALE_COOKIE_NAME}=ru`;

    expect(getApiErrorMessage(failure('STORAGE_FILE_NOT_FOUND', 'File not found'))).toBe(
      ru(documents, 'STORAGE_FILE_NOT_FOUND'),
    );
    expect(getApiErrorMessage(failure('TABLE_NOT_FOUND', 'Table not found'))).toBe(
      ru(apiErrors, 'TABLE_NOT_FOUND'),
    );
  });

  it("falls back to the backend's English text for a code no dictionary knows", () => {
    document.cookie = `${LOCALE_COOKIE_NAME}=ru`;

    expect(getApiErrorMessage(failure('SOMETHING_NEW', 'Something new went wrong'))).toBe(
      'Something new went wrong',
    );
  });
});
