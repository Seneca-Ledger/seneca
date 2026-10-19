export enum ReviewInboxKind {
  TRANSACTION = 'transaction',
  RECEIPT = 'receipt',
  DUPLICATE = 'duplicate',
  SUBSCRIPTION = 'subscription',
}

export enum DuplicateDecision {
  /** It is a duplicate: leave it flagged, stop asking. */
  CONFIRM = 'confirm',
  /** It is a real transaction: restore it. */
  KEEP = 'keep',
}
