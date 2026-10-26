import { type Cause, Schema, SchemaIssue } from 'effect';

const toIssues = SchemaIssue.makeFormatterStandardSchemaV1();

/** `path: message` per problem in a failed decode, for error bodies and logs. */
export function describeSchemaFailure(cause: Cause.Cause<unknown>): string[] {
  const error = cause.reasons.find(reason => reason._tag === 'Fail')?.error;
  if (!Schema.isSchemaError(error)) {
    return [];
  }
  return toIssues(error.issue).issues.map(issue =>
    issue.path?.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
  );
}

/** A UTF-16 surrogate without its pair: not a character, so not storable. */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const isUnstorable = (text: string) => text.includes('\0') || LONE_SURROGATE.test(text);

/**
 * `path: message` for the first string Postgres cannot store: JSON carries a
 * NUL character or a lone surrogate, and text and jsonb columns refuse both
 * with a 500. Keys count too: an object lands in a jsonb column as it is.
 */
export function describeUnstorableText(value: unknown, path: string[] = []): string | undefined {
  if (typeof value === 'string') {
    return isUnstorable(value)
      ? `${path.length ? `${path.join('.')}: ` : ''}Expected text without NUL characters or broken Unicode`
      : undefined;
  }
  if (typeof value !== 'object' || value === null) return undefined;
  for (const [key, item] of Object.entries(value)) {
    const found =
      describeUnstorableText(key, [...path, key]) ?? describeUnstorableText(item, [...path, key]);
    if (found) return found;
  }
  return undefined;
}
