import type { UncheckedResponse } from './api';

/**
 * The body of a `responseType: 'blob'` request. Checked rather than cast: a
 * JSON error the server sent instead would otherwise be saved as the file.
 * Its own module, so tests that mock the api client keep the real check.
 */
export function blobOf(response: UncheckedResponse): Blob {
  if (!(response.data instanceof Blob)) {
    throw new TypeError(`Expected a file from ${response.config?.url ?? 'the API'}`);
  }
  return response.data;
}
