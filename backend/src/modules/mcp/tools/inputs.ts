import { Schema } from 'effect';

/** Argument building blocks shared by the tools. */

export const Uuid = Schema.String.check(Schema.isUUID());

/** A calendar day, as the REST date filters take it. */
export const Day = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/, { message: 'Expected a date as YYYY-MM-DD' }),
);

export const Page = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1));

export const Limit = (max: number) =>
  Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: max }));

export const described = <S extends Schema.Top>(schema: S, description: string): S =>
  schema.annotate({ description }) as S;
