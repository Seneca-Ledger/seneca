import { type Transaction, TransactionCategorySource } from '../../../entities/transaction.entity';
import type { ClassificationRule } from '../interfaces/classification-rule.interface';

/**
 * Writes what a matched rule sets onto the classification. A key the rule
 * leaves out is left alone. Tags are not written here: they are added to a
 * row, never assigned, and the caller knows which of them still exist.
 *
 * @returns whether the rule named the owner, which then beats the wallet's.
 */
export function applyRuleResult(
  rule: ClassificationRule,
  classification: Partial<Transaction>,
): { ruleSetOwner: boolean } {
  const { result } = rule;
  if (result.categoryId) {
    classification.categoryId = result.categoryId;
    classification.categorySource = TransactionCategorySource.RULE;
    classification.categoryReason = rule.name;
  }
  if (result.branchId) {
    classification.branchId = result.branchId;
  }
  if (result.walletId) {
    classification.walletId = result.walletId;
  }
  if (result.article) {
    classification.article = result.article;
  }
  if (result.activityType) {
    classification.activityType = result.activityType;
  }
  if (result.ownerMemberId === undefined) {
    return { ruleSetOwner: false };
  }
  classification.ownerMemberId = result.ownerMemberId;
  return { ruleSetOwner: true };
}
