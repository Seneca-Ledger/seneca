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
