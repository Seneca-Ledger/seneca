import type { CategorizationRule, ClassificationConditionInput } from '@/app/lib/contracts';

export type Rule = CategorizationRule;
export type RuleCondition = ClassificationConditionInput;
export type RuleField = RuleCondition['field'];
export type RuleOperator = RuleCondition['operator'];

/** What the editor sends on create and on edit. Where a new rule goes is the server's call (on top). */
export interface RuleDraftBody {
  name: string;
  conditions: RuleCondition[];
  result: {
    categoryId?: string;
    walletId?: string;
    ownerMemberId?: string | null;
    tagIds?: string[];
  };
}

/** A rule the editor opens with: an existing one, or a draft made from a transaction. */
export interface RuleSeed {
  id: string | null;
  name: string;
  conditions: RuleCondition[];
  result: RuleDraftBody['result'];
}

/** The fields the editor offers; the rest stay reachable through the API. */
export const TEXT_FIELDS: RuleField[] = ['counterparty_name', 'payment_purpose'];
export const TEXT_OPERATORS: RuleOperator[] = ['contains', 'equals', 'starts_with', 'ends_with'];
export const AMOUNT_OPERATORS: RuleOperator[] = ['greater_than', 'less_than', 'equals'];

export function operatorsFor(field: RuleField): RuleOperator[] {
  if (field === 'amount') {
    return AMOUNT_OPERATORS;
  }
  if (
    field === 'owner' ||
    field === 'direction' ||
    field === 'wallet' ||
    field === 'payment_type'
  ) {
    return ['equals'];
  }
  return TEXT_OPERATORS;
}

export const EMPTY_CONDITION: RuleCondition = {
  field: 'counterparty_name',
  operator: 'contains',
  value: '',
};
