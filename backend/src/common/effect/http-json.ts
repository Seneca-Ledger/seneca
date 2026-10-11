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
