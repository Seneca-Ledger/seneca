/**
 * Which step of the classification chain set `categoryId`, in order of
 * precedence. `manual` is sticky: re-classification never overrides it.
 */
export enum TransactionCategorySource {
  MANUAL = 'manual',
  RULE = 'rule',
  KEYWORD = 'keyword',
  LEARNED = 'learned',
  HISTORY = 'history',
  AI = 'ai',
  DEFAULT = 'default',
  /** Suggested from the kind of the operation: cash, salary, a transfer to a person. */
  KIND = 'kind',
  /** Suggested from a known brand in the descriptor. */
  BRAND = 'brand',
  /** Suggested from a receipt that matches the row: its category, or what its vendor is. */
  RECEIPT = 'receipt',
}
