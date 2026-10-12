/**
 * The HTTP client reference data is fetched with. A provider so tests can
 * hand in a fake instead of reaching the internet.
 */
export const REFERENCE_FETCH = Symbol('REFERENCE_FETCH');

export type ReferenceFetch = typeof fetch;

export const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Set REFERENCE_DATA_OFFLINE=true on an instance that must not call out:
 * holidays and official VAT rates are then simply not known, and everything
 * that uses them falls back to what it did without them.
 */
export function referenceDataOffline(): boolean {
  return process.env.REFERENCE_DATA_OFFLINE === 'true';
}
