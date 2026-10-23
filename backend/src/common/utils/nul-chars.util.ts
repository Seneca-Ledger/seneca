import type { ValueTransformer } from 'typeorm';

/**
 * Postgres refuses U+0000 in `text` and `jsonb`, and text pulled out of a PDF
 * can carry it. Strings, keys and nested values are cleaned; the rest is kept.
 */
export function withoutNulChars<T>(value: T): T {
  if (typeof value === 'string') {
    return value.replaceAll('\u0000', '') as T;
  }
  if (Array.isArray(value)) {
    return value.map(item => withoutNulChars(item)) as T;
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [withoutNulChars(key), withoutNulChars(item)]),
    ) as T;
  }
  return value;
}

/** For a column written with whatever a parser read from a file. */
export const nulFreeTransformer: ValueTransformer = {
  to: value => withoutNulChars(value),
  from: value => value,
};
