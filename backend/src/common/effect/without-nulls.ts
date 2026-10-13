import type { EntityMetadata } from 'typeorm';

/** `T` with `null` taken out of every field. */
export type WithoutNulls<T> = { [K in keyof T]: Exclude<T[K], null> };

/**
 * A create body without its null fields. Request bodies accept null wherever
 * `@IsOptional()` did; on a new row null and absent mean the same thing, and
 * dropping the key lets the column default apply instead of failing NOT NULL.
 */
export function withoutNulls<T extends object>(body: T): WithoutNulls<T> {
  return Object.fromEntries(
    Object.entries(body).filter(([, value]) => value !== null),
  ) as WithoutNulls<T>;
}

/**
 * An update body without the nulls aimed at NOT NULL columns. Update bodies
 * accept null wherever `@IsOptional()` did: on a nullable column it clears the
 * value, on a required one it can only mean "leave it" (saving it failed
 * NOT NULL with a 500). Keys that are not columns are left as they are.
 */
export function withoutNullsOnRequired<T extends object>(
  metadata: EntityMetadata | undefined,
  body: T,
): T {
  return Object.fromEntries(
    Object.entries(body).filter(
      ([key, value]) =>
        value !== null || (metadata?.findColumnWithPropertyName(key)?.isNullable ?? true),
    ),
  ) as T;
}
