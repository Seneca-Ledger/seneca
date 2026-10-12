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
