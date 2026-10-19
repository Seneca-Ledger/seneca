import { Data, Effect } from 'effect';

/**
 * Retry policy shared by the two rate-limited providers a sync depends on: the
 * block explorer and the price API.
 *
 * Both are free, anonymous endpoints with a per-minute budget, and both are called
 * from inside an HTTP request, so the policy is the same for each — sleep through a
 * short refusal, give up on a long one and let the next sync continue.
 */

export const MAX_ATTEMPTS = 3;

/**
 * A provider that names a delay longer than this is telling us to come back later,
 * not to wait. Holding a request open for a minute is worse than failing with an
 * error the user can see and retry.
 */
const MAX_RETRY_WAIT_MS = 10_000;
const BACKOFF_MS = [1_000, 4_000];

/** Milliseconds to wait before the next attempt, or null when waiting is pointless. */
export function retryWaitMs(response: Response | null, attempt: number): number | null {
  const retryAfter = Number(response?.headers.get('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    const requested = retryAfter * 1000;
    return requested > MAX_RETRY_WAIT_MS ? null : requested;
  }
  return BACKOFF_MS[attempt] ?? null;
}

/** True when the response is worth asking about again rather than an answer. */
export function isTransient(response: Response | null): boolean {
  return response === null || response.status === 429 || response.status >= 500;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * No single call may hold a sync longer than this. Before, a provider that
 * accepted the connection and never answered kept the request open forever.
 */
export const ATTEMPT_TIMEOUT_MS = 20_000;

/** A 4xx that is not a rate limit: the provider answered, and the answer is no. */
export class ProviderAnswered extends Data.TaggedError('ProviderAnswered')<{
  readonly status: number;
}> {}

/** Still refused (or silent) once the retry policy ran out. */
export class ProviderUnavailable extends Data.TaggedError('ProviderUnavailable')<{
  /** Absent when nothing answered: network error or timeout. */
  readonly status?: number;
  readonly attempts: number;
}> {}

/** The provider answered 200 with a body that is not JSON. */
class ProviderUnreadable extends Data.TaggedError('ProviderUnreadable') {}

/**
 * The shared policy as one Effect: each attempt is capped at ATTEMPT_TIMEOUT_MS
 * and aborted when it runs over; a transient refusal waits as `retryWaitMs`
 * says and asks again, up to MAX_ATTEMPTS.
 */
export function requestWithRetry(
  url: string,
  init: RequestInit,
  onRetry: (status: number | undefined, waitMs: number) => void,
): Effect.Effect<Response, ProviderAnswered | ProviderUnavailable> {
  const attempt = (
    index: number,
  ): Effect.Effect<Response, ProviderAnswered | ProviderUnavailable> =>
    Effect.tryPromise({ try: signal => fetch(url, { ...init, signal }), catch: () => null }).pipe(
      Effect.timeout(ATTEMPT_TIMEOUT_MS),
      Effect.orElseSucceed(() => null),
      Effect.flatMap(response => {
        if (response?.ok) {
          return Effect.succeed(response);
        }
        if (response && !isTransient(response)) {
          return Effect.fail(new ProviderAnswered({ status: response.status }));
        }
        const wait = retryWaitMs(response, index);
        if (wait === null || index === MAX_ATTEMPTS - 1) {
          return Effect.fail(
            new ProviderUnavailable({ status: response?.status, attempts: index + 1 }),
          );
        }
        onRetry(response?.status, wait);
        return Effect.sleep(wait).pipe(Effect.andThen(attempt(index + 1)));
      }),
    );
  return attempt(0);
}

/**
 * GETs (or POSTs) JSON with the shared retry policy. `name` goes into the error so
 * a failed sync says which provider let it down.
 */
export function fetchJsonWithRetry<T>(
  url: string,
  init: RequestInit,
  name: string,
  onRetry: (message: string) => void,
): Promise<T> {
  return Effect.runPromise(
    requestWithRetry(url, init, (status, wait) =>
      onRetry(`${name} returned ${status}, retrying in ${wait}ms`),
    ).pipe(
      Effect.flatMap(response =>
        Effect.tryPromise({
          try: () => response.json() as Promise<T>,
          catch: () => new ProviderUnreadable(),
        }),
      ),
      Effect.mapError(error => {
        switch (error._tag) {
          case 'ProviderUnreadable':
            return new Error(`${name} sent an unreadable answer`);
          case 'ProviderAnswered':
            return new Error(`${name} returned HTTP ${error.status}`);
          case 'ProviderUnavailable':
            return new Error(
              error.status === undefined
                ? `${name} is unreachable`
                : `${name} returned HTTP ${error.status}`,
            );
        }
      }),
    ),
  );
}
