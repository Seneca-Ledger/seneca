import * as Schema from 'effect/Schema';
import * as SchemaTransformation from 'effect/SchemaTransformation';
import * as Struct from 'effect/Struct';

/**
 * Building blocks for request bodies. They reproduce what the class-validator
 * DTOs accepted, so moving a body onto a schema changes no client's 400s.
 */

/**
 * What `@IsOptional()` accepted: the key may be missing, undefined or null.
 * Services that clear a field on null (a category, a wallet, an amount) get
 * exactly what they got from the class-validator DTOs.
 */
interface OptionalNullable extends Struct.Lambda {
  <S extends Schema.Top>(self: S): Schema.optional<Schema.NullOr<S>>;
  readonly '~lambda.out': this['~lambda.in'] extends Schema.Top
    ? Schema.optional<Schema.NullOr<this['~lambda.in']>>
    : never;
}

// A Struct lambda, so PartialType-style bodies can map every field through it.
export const optionalNullable = Struct.lambda<OptionalNullable>(schema =>
  Schema.optional(Schema.NullOr(schema)),
);

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

/**
 * The date part names a day that exists (no 2026-02-30, no year 0) and the
 * whole string parses: Postgres rejects anything else with a 500.
 */
const isExistingDate = Schema.makeFilter<string>(value => {
  const day = value.slice(0, 10);
  const parsed = new Date(`${day}T00:00:00Z`);
  return day.slice(0, 4) !== '0000' &&
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === day &&
    !Number.isNaN(Date.parse(value.replace(' ', 'T')))
    ? undefined
    : 'Expected a date that exists';
});

/** ISO 8601 date (`YYYY-MM-DD`) or timestamp, as `@IsDateString()` accepted. */
export const IsoDateString = Schema.String.check(
  Schema.isPattern(
    /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}(?::?\d{2})?)?)?$/,
    { message: 'Expected an ISO 8601 date' },
  ),
  isExistingDate,
);

/** A calendar date, `YYYY-MM-DD`, with a real month and day range. */
export const DateOnlyInput = Schema.String.check(
  Schema.isPattern(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, {
    message: 'Expected a date as YYYY-MM-DD',
  }),
  isExistingDate,
);

/**
 * A list in a query string: repeated keys (`?a=x&a=y`), comma-separated
 * values (`?a=x,y`) or both, trimmed, empty parts dropped.
 */
export const StringListInput = Schema.Union([Schema.String, Schema.Array(Schema.String)]).pipe(
  Schema.decodeTo(
    Schema.Array(Schema.String),
    SchemaTransformation.transform({
      decode: (value: string | ReadonlyArray<string>): ReadonlyArray<string> =>
        (typeof value === 'string' ? [value] : value)
          .flatMap(item => item.split(','))
          .map(item => item.trim())
          .filter(Boolean),
      encode: (value: ReadonlyArray<string>): string | ReadonlyArray<string> => value.join(','),
    }),
  ),
);

/** A whole number from a query string, at least 1: page numbers and sizes. */
export const PageInput = NumericInput.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1));

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
