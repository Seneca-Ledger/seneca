import { type Duration, Effect, Schedule, type Schema } from 'effect';
import {
  HttpClient,
  type HttpClientError,
  HttpClientRequest,
  HttpClientResponse,
} from 'effect/http';

/**
 * GET a JSON body and decode it. Network errors, 429 and 5xx are retried twice
 * with jittered backoff, all within `timeout`. Any other non-2xx fails with an
 * HttpClientError whose `response.status` says which (see `hasStatus`).
 */
export const getJson = <A>(
  url: string,
  schema: Schema.Codec<A, unknown>,
  options: { readonly timeout: Duration.Input; readonly headers?: Record<string, string> },
) =>
  Effect.gen(function* () {
    const client = (yield* HttpClient.HttpClient).pipe(
      HttpClient.filterStatusOk,
      HttpClient.retryTransient({
        schedule: Schedule.exponential('250 millis').pipe(Schedule.jittered),
        times: 2,
      }),
    );
    const request = HttpClientRequest.get(url).pipe(
      HttpClientRequest.setHeaders({ accept: 'application/json', ...options.headers }),
    );
    const response = yield* client.execute(request);
    return yield* HttpClientResponse.schemaBodyJson(schema)(response);
  }).pipe(Effect.timeout(options.timeout));

/**
 * GET and let `read` judge the answer: status, headers and body are read
 * inside the same `timeout`. For callers that tell "not there" (a 404 worth
 * caching) from "not now" (anything else), or read text or bytes rather than
 * JSON. Network failures are retried only with `retry`: most of the providers
 * this serves have small free quotas.
 */
export const getWith = <A, E, R>(
  url: string,
  options: {
    readonly timeout: Duration.Input;
    readonly headers?: Record<string, string>;
    readonly retry?: boolean;
  },
  read: (response: HttpClientResponse.HttpClientResponse) => Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    const base = yield* HttpClient.HttpClient;
    const client = options.retry
      ? base.pipe(
          HttpClient.retryTransient({
            schedule: Schedule.exponential('250 millis').pipe(Schedule.jittered),
            times: 2,
          }),
        )
      : base;
    const response = yield* client.execute(
      HttpClientRequest.get(url).pipe(HttpClientRequest.setHeaders(options.headers ?? {})),
    );
    return yield* read(response);
  }).pipe(Effect.timeout(options.timeout));

/** The media type of a response, without parameters (`image/png; q=1` → `image/png`). */
export const contentTypeOf = (response: HttpClientResponse.HttpClientResponse): string =>
  (response.headers['content-type'] ?? '').split(';')[0].trim();

/** True for an HttpClientError carrying a response with this status. */
export const hasStatus =
  (status: number) =>
  (error: { readonly _tag: string }): error is HttpClientError.HttpClientError =>
    error._tag === 'HttpClientError' &&
    (error as HttpClientError.HttpClientError).response?.status === status;

/**
 * Tag and status for a log line. Never the error message: it quotes the URL,
 * and some providers take their API key in it.
 */
export const describeHttpFailure = (error: { readonly _tag: string }): string => {
  const status =
    error._tag === 'HttpClientError'
      ? (error as HttpClientError.HttpClientError).response?.status
      : undefined;
  return status ? `${error._tag} ${status}` : error._tag;
};
