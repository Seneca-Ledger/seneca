import type { Schema } from 'effect';
import type * as Contracts from './contracts';
import { type ApiQueryOptions, apiQuery } from './query-fn';

type ContractSchemas = typeof Contracts;
/** The contracts in packages/contracts that are schemas (not their types). */
export type ContractName = {
  [K in keyof ContractSchemas]: ContractSchemas[K] extends Schema.Top ? K : never;
}[keyof ContractSchemas];
export type ContractType<K extends ContractName> = ContractSchemas[K]['Type'];

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

/**
 * Types an API payload by its contract, and in development, tests and e2e also
 * checks it, throwing ContractMismatchError on drift. Production skips the
 * check: the branch, the dynamic import and with them effect (~67 kB gzip) are
 * compiled out, and the payload passes through as before. Contracts describe
 * the wire format without transformations, so the payload is the value.
 */
export async function checkContract<K extends ContractName>(
  name: K,
  payload: unknown,
  url: string,
): Promise<ContractType<K>> {
  if (process.env.NODE_ENV !== 'production') {
    const { assertMatchesContract } = await import('./contract-check');
    assertMatchesContract(name, payload, url);
  }
  return payload as ContractType<K>;
}

/** `apiQuery` whose result is typed, and outside production checked, by a contract. */
export async function apiQueryDecoded<K extends ContractName>(
  options: ApiQueryOptions & { contract: K },
): Promise<ContractType<K>> {
  const { contract, ...query } = options;
  return checkContract(contract, await apiQuery<unknown>(query), query.url);
}
