import { Effect, Schedule, Schema } from 'effect';
import { HttpClient, HttpClientResponse } from 'effect/http';

/** exchangerate-api.com `latest/{base}`. */
export const LatestRatesResponse = Schema.Struct({
  result: Schema.String,
  conversion_rates: Schema.Record(Schema.String, Schema.Number),
});

/** fawazahmed0 currency-api: `{ date, <base>: { <code>: rate } }`; read leniently by the service. */
export const PublicRatesResponse = Schema.Record(Schema.String, Schema.Unknown);

/**
 * GET a JSON body and decode it. Network errors, 429 and 5xx are retried twice
 * with jittered backoff, and the whole call gives up after five seconds — the
 * bare `fetch` this replaces could hang a conversion indefinitely.
 */
export const getJson = <A>(url: string, schema: Schema.Codec<A, unknown>) =>
  Effect.gen(function* () {
    const client = (yield* HttpClient.HttpClient).pipe(
      HttpClient.filterStatusOk,
      HttpClient.retryTransient({
        schedule: Schedule.exponential('250 millis').pipe(Schedule.jittered),
        times: 2,
      }),
    );
    const response = yield* client.get(url);
    return yield* HttpClientResponse.schemaBodyJson(schema)(response);
  }).pipe(Effect.timeout('5 seconds'));
