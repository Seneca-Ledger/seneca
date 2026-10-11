import * as Schema from 'effect/Schema';

/**
 * How Postgres values arrive in JSON. TypeORM hands `decimal`/`numeric` columns
 * over as strings and `date` columns as `YYYY-MM-DD`, whatever the entity type
 * says; reading them as numbers needs an explicit `Number(...)`.
 */
export const DecimalString = Schema.String.check(
  Schema.isPattern(/^-?\d+(\.\d+)?$/, { message: 'Expected a decimal string' }),
);
export const DateOnly = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/, { message: 'Expected YYYY-MM-DD' }),
);
/** ISO timestamp, as JSON.stringify writes a Date. */
export const Timestamp = Schema.String;

/**
 * The TypeScript type of a contract. Mutable on purpose: it is plain JSON, which
 * the backend builds up and the frontend passes to ordinary array helpers.
 */
export type Wire<S extends Schema.Top> = Mutable<S['Type']>;

/**
 * What a client sends for a request-body schema: its encoded side. Differs from
 * `Wire` only where the body decodes something (a numeric string, a default).
 */
export type WireInput<S extends Schema.Top> = Mutable<S['Encoded']>;

/** Readonly-free copy of a decoded type. Unlike effect's DeepMutable it leaves `unknown` alone. */
type Mutable<T> = unknown extends T
  ? T
  : T extends ReadonlyArray<infer Item>
    ? Array<Mutable<Item>>
    : T extends object
      ? { -readonly [K in keyof T]: Mutable<T[K]> }
      : T;
