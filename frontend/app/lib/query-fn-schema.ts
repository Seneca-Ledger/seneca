import type { Schema } from 'effect';
import type * as Contracts from './contracts';
import type { Wire } from './contracts';
import { type ApiQueryOptions, apiQuery } from './query-fn';

type ContractSchemas = typeof Contracts;
/** The contracts in packages/contracts that are schemas (not their types). */
export type ContractName = {
  [K in keyof ContractSchemas]: ContractSchemas[K] extends Schema.Top ? K : never;
}[keyof ContractSchemas];
export type ContractType<K extends ContractName> = Wire<ContractSchemas[K]>;

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

/**
 * checkContract for requests whose failure handling would mislead on drift —
 * the session load signs the user out, the workspace load blanks the app.
 * Outside production a mismatch is logged instead of thrown.
 */
export async function reportContractDrift<K extends ContractName>(
  name: K,
  payload: unknown,
  url: string,
): Promise<ContractType<K>> {
  try {
    return await checkContract(name, payload, url);
  } catch (error) {
    console.error(error);
    return payload as ContractType<K>;
  }
}

/**
 * `apiQuery` whose result is typed, and outside production checked, by a
 * contract. `drift: 'report'` logs a mismatch instead of throwing — for
 * background feeds, where a thrown error would only leave an empty list.
 */
export async function apiQueryDecoded<K extends ContractName>(
  options: ApiQueryOptions & { contract: K; drift?: 'throw' | 'report' },
): Promise<ContractType<K>> {
  const { contract, drift = 'throw', ...query } = options;
  const payload = await apiQuery<unknown>(query);
  return drift === 'report'
    ? reportContractDrift(contract, payload, query.url)
    : checkContract(contract, payload, query.url);
}
