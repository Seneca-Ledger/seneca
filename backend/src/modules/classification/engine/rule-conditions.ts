import { OWNER_SHARED } from '../../../common/utils/transaction-owner.util';
import type { Transaction } from '../../../entities/transaction.entity';
import type { ClassificationCondition } from '../interfaces/classification-rule.interface';

/** The value of the transaction a rule condition looks at. */
function ruleFieldValue(transaction: Transaction, field: string): string | number | null {
  switch (field) {
    case 'counterparty_name':
      return transaction.counterpartyName;
    case 'payment_purpose':
      return transaction.paymentPurpose;
    case 'amount':
      return transaction.amount || transaction.debit || transaction.credit || 0;
    case 'counterparty_bin':
      return transaction.counterpartyBin || null;
    case 'document_number':
      return transaction.documentNumber || null;
    // `shared` rather than null: the condition evaluator treats null as "no
    // value" and refuses to match, so a rule about shared rows needs a word.
    case 'owner':
      return transaction.ownerMemberId ?? OWNER_SHARED;
    case 'direction':
      return transaction.transactionType ?? null;
    case 'payment_type':
      return transaction.paymentType ?? null;
    case 'wallet':
      return transaction.walletId ?? null;
    default:
      return null;
  }
}

export function evaluateCondition(
  fieldValue: string | number | null,
  condition: ClassificationCondition,
): boolean {
  if (fieldValue === null || fieldValue === undefined) {
    return false;
  }

  const conditionValue = condition.value;
  const fieldStr = String(fieldValue).toLowerCase();
  const conditionStr = String(conditionValue).toLowerCase();

  switch (condition.operator) {
    case 'contains':
      return fieldStr.includes(conditionStr);
    case 'equals':
      return fieldStr === conditionStr;
    case 'starts_with':
      return fieldStr.startsWith(conditionStr);
    case 'ends_with':
      return fieldStr.endsWith(conditionStr);
    case 'regex':
      try {
        const regex = new RegExp(conditionValue as string, 'i');
        return regex.test(fieldStr);
      } catch {
        return false;
      }
    case 'greater_than':
      return Number(fieldValue) > Number(conditionValue);
    case 'less_than':
      return Number(fieldValue) < Number(conditionValue);
    default:
      return false;
  }
}

function conditionHolds(transaction: Transaction, condition: ClassificationCondition): boolean {
  return evaluateCondition(ruleFieldValue(transaction, condition.field), condition);
}

export function matchesConditions(
  transaction: Transaction,
  conditions: ClassificationCondition[],
): boolean {
  return conditions.every(condition => conditionHolds(transaction, condition));
}

/** The conditions a matching row satisfied, worded for the rule preview. */
export function explainMatch(
  transaction: Transaction,
  conditions: ClassificationCondition[],
): string {
  return conditions
    .filter(condition => conditionHolds(transaction, condition))
    .map(condition => `${condition.field} ${condition.operator} "${condition.value}"`)
    .join(' AND ');
}
