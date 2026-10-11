// Subpath imports only: `import { Schema } from 'effect'` pulls the whole
// barrel. Even so, the decoder is ~67 kB gzip in the webpack build, so it stays
// out of modules every page loads and ships only with routes that decode.
import * as Exit from 'effect/Exit';
import * as Schema from 'effect/Schema';
import * as SchemaIssue from 'effect/SchemaIssue';
import { type ApiQueryOptions, apiQuery } from './query-fn';

/** The API answered with something its contract in packages/contracts does not describe. */
export class ContractMismatchError extends Error {
  constructor(
    readonly url: string,
    readonly issues: string[],
  ) {
    super(`Response from ${url} does not match its contract:\n${issues.join('\n')}`);
    this.name = 'ContractMismatchError';
  }
}

const toIssues = SchemaIssue.makeFormatterStandardSchemaV1();

/**
 * Checks an API payload against its contract. Extra fields pass through
 * untouched, so the backend can add one before the frontend knows it. A mismatch throws in
 * development and tests, where it can be fixed; in production the payload is
 * logged and passed through as before, so drift degrades instead of breaking
 * the page.
 */
export function decodeResponse<A>(
  schema: Schema.Codec<A, unknown>,
  payload: unknown,
  url: string,
): A {
  const exit = Schema.decodeUnknownExit(schema, { errors: 'all' })(payload);
  if (Exit.isSuccess(exit)) {
    // Contracts describe the wire format without transformations, so the
    // payload itself is the decoded value, and keeps the fields decoding drops.
    return payload as A;
  }
  const failure = exit.cause.reasons.find(reason => reason._tag === 'Fail')?.error;
  const issues = Schema.isSchemaError(failure)
    ? toIssues(failure.issue).issues.map(
        issue => `${issue.path?.join('.') ?? ''}: ${issue.message}`,
      )
    : [String(failure)];
  const error = new ContractMismatchError(url, issues);
  if (process.env.NODE_ENV !== 'production') {
    throw error;
  }
  console.error(error);
  return payload as A;
}

/** `apiQuery` whose result is checked against a contract schema. */
export async function apiQueryDecoded<A>(
  options: ApiQueryOptions & { schema: Schema.Codec<A, unknown> },
): Promise<A> {
  const { schema, ...query } = options;
  return decodeResponse(schema, await apiQuery<unknown>(query), query.url);
}
