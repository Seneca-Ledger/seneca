import { Schema } from 'effect';

/** exchangerate-api.com `latest/{base}`. */
export const LatestRatesResponse = Schema.Struct({
  result: Schema.String,
  conversion_rates: Schema.Record(Schema.String, Schema.Number),
});

/** fawazahmed0 currency-api: `{ date, <base>: { <code>: rate } }`; read leniently by the service. */
export const PublicRatesResponse = Schema.Record(Schema.String, Schema.Unknown);
