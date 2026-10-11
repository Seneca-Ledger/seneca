// Loaded only outside production (see checkContract in query-fn-schema.ts), so
// effect and the contract schemas never reach the production bundle.
import * as Exit from 'effect/Exit';
import * as Schema from 'effect/Schema';
import * as SchemaIssue from 'effect/SchemaIssue';
import * as contracts from './contracts';
import { ContractMismatchError, type ContractName } from './query-fn-schema';

const toIssues = SchemaIssue.makeFormatterStandardSchemaV1();

/** Throws ContractMismatchError when `payload` is not what contract `name` describes. */
export function assertMatchesContract(name: ContractName, payload: unknown, url: string): void {
  const schema: Schema.Codec<unknown, unknown> = contracts[name];
  const exit = Schema.decodeUnknownExit(schema, { errors: 'all' })(payload);
  if (Exit.isSuccess(exit)) {
    return;
  }
  const failure = exit.cause.reasons.find(reason => reason._tag === 'Fail')?.error;
  const issues = Schema.isSchemaError(failure)
    ? toIssues(failure.issue).issues.map(
        issue => `${issue.path?.join('.') ?? ''}: ${issue.message}`,
      )
    : [String(failure)];
  throw new ContractMismatchError(url, issues);
}
