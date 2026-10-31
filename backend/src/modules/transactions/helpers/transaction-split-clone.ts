import type { Transaction } from '../../../entities/transaction.entity';

/**
 * Builds the sibling template: every column a split part inherits verbatim from
 * the row it was split from. An allowlist, so a newly added column is inherited
 * only once someone decides it should be.
 *
 * Excluded on purpose: `id` and the createdAt/updatedAt timestamps; the loaded
 * relation objects (category, wallet, branch, ...), so saving a part never
 * cascades into them; the per-part money columns (amount/debit/credit/
 * amountForeign) and the split markers, which `split()` assigns itself;
 * `fingerprint`, which backfill recomputes from the post-split amount; and the
 * duplicate-flag columns, unreachable because a flagged row cannot be split.
 */
export function cloneForSplit(source: Transaction): Partial<Transaction> {
  return {
    workspaceId: source.workspaceId,
    statementId: source.statementId,
    transactionDate: source.transactionDate,
    documentNumber: source.documentNumber,
    counterpartyName: source.counterpartyName,
    counterpartyBin: source.counterpartyBin,
    counterpartyAccount: source.counterpartyAccount,
    counterpartyBank: source.counterpartyBank,
    counterpartyCountry: source.counterpartyCountry,
    counterpartyVatId: source.counterpartyVatId,
    currency: source.currency,
    exchangeRate: source.exchangeRate,
    paymentPurpose: source.paymentPurpose,
    paymentType: source.paymentType,
    categoryId: source.categoryId,
    categorySource: source.categorySource,
    categoryReason: source.categoryReason,
    // The rate carries over, but never the assessed figures: those belong to
    // the pre-split amount, and copying them onto each part would multiply
    // the transaction's tax by the number of parts. `split()` re-assesses
    // every part from its own amount and category instead.
    taxRateId: source.taxRateId,
    taxSource: source.taxSource,
    branchId: source.branchId,
    walletId: source.walletId,
    // Each part starts on the same person as the whole; splitting a shared
    // purchase between two people is done by reassigning the parts afterwards.
    ownerMemberId: source.ownerMemberId,
    article: source.article,
    activityType: source.activityType,
    vendorNormalized: source.vendorNormalized,
    categoryHint: source.categoryHint,
    transactionNature: source.transactionNature,
    taxDetected: source.taxDetected,
    enrichmentConfidence: source.enrichmentConfidence,
    transactionType: source.transactionType,
    comments: source.comments,
    isVerified: source.isVerified,
    importSessionId: source.importSessionId,
  };
}
