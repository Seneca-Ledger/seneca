/**
 * Shared utilities for side panel components.
 * Used by the statements queue tabs and other intlayer-fed labels.
 */

/**
 * Safely casts an unknown value to a Record if it is a non-null object.
 */
export const getRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;

/**
 * Traverses a nested unknown structure using a dot-segment path array.
 * Returns `undefined` if any intermediate segment is missing or not an object.
 */
export const getNestedValue = (root: unknown, path: string[]): unknown => {
  let current: unknown = root;
  for (const segment of path) {
    const record = getRecord(current);
    if (!record) return undefined;
    current = record[segment];
  }
  return current;
};

/**
 * Resolves a display label from an unknown intlayer value.
 * Returns the string directly when the value is already a string,
 * falls back to `record.value` when available, otherwise returns `fallback`.
 */
export const resolveLabel = (value: unknown, fallback: string): string => {
  if (typeof value === 'string') return value;
  const record = getRecord(value);
  return typeof record?.value === 'string' ? (record.value as string) : fallback;
};
