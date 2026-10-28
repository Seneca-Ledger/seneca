/**
 * YYYY-MM-DD for a `date` column. Postgres returns loaded `date` values as
 * strings although the entity types them as Date; only dates set in this
 * request are Date objects.
 */
export function dateOnly(value: Date | string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  return (value instanceof Date ? value.toISOString() : String(value)).split('T')[0];
}
