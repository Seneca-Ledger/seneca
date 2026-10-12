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
