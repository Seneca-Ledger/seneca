/** Why a given rate ended up on a transaction. */
export enum TaxSource {
  /** The user picked the rate themselves. */
  MANUAL = 'manual',
  /** Matched a workspace tax rule. */
  RULE = 'rule',
  /** Fell through to the workspace default for that date. */
  DEFAULT = 'default',
  /** Read off the source document by the parser. */
  PARSED = 'parsed',
}
