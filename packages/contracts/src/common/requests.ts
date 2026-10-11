import * as Schema from 'effect/Schema';
import * as SchemaTransformation from 'effect/SchemaTransformation';

/**
 * Building blocks for request bodies. They reproduce what the class-validator
 * DTOs accepted, so moving a body onto a schema changes no client's 400s.
 */

/** A number that may arrive as a numeric string: multipart fields, query-shaped bodies. */
export const NumericInput = Schema.Union([Schema.Finite, Schema.FiniteFromString]);

const BooleanString = Schema.Literals(['true', 'false']).pipe(
  Schema.decodeTo(
    Schema.Boolean,
    SchemaTransformation.transform({
      decode: value => value === 'true',
      encode: value => (value ? 'true' : 'false'),
    }),
  ),
);

/** A boolean that may arrive as "true"/"false": multipart fields. */
export const BooleanInput = Schema.Union([Schema.Boolean, BooleanString]);

/** A string stored trimmed and lowercased (domains, codes). */
export const TrimmedLowercase = Schema.String.pipe(
  Schema.decodeTo(
    Schema.String,
    SchemaTransformation.transform({
      decode: value => value.trim().toLowerCase(),
      encode: value => value,
    }),
  ),
);

/** ISO 8601 date (`YYYY-MM-DD`) or timestamp, as `@IsDateString()` accepted. */
export const IsoDateString = Schema.String.check(
  Schema.isPattern(
    /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}(?::?\d{2})?)?)?$/,
    { message: 'Expected an ISO 8601 date' },
  ),
);

export const Email = Schema.String.check(
  Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: 'Expected an email address' }),
);

export const Url = Schema.String.check(
  Schema.isPattern(/^https?:\/\/[^\s/$.?#][^\s]*$/i, { message: 'Expected an http(s) URL' }),
);

/** Money as it is stored: no more than two decimal places. */
export const isAtMostTwoDecimals = Schema.makeFilter<number>(value =>
  Math.abs(Math.round(value * 100) - value * 100) < 1e-6
    ? undefined
    : 'Expected at most 2 decimal places',
);
