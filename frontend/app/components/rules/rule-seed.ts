import { EMPTY_CONDITION, type Rule, type RuleCondition, type RuleSeed } from './types';

/** What a link to a new rule can carry: a payee to match, and what to file it as. */
export interface NewRuleDraft {
  payee: string;
  /** `contains` by default; `equals` when the bank text is the whole descriptor. */
  match?: 'contains' | 'equals';
  categoryId?: string;
  direction?: 'income' | 'expense';
}

export function blankSeed(): RuleSeed {
  return { id: null, name: '', conditions: [EMPTY_CONDITION], result: {} };
}

/** A saved rule as the editor holds it. */
export function seedOf(rule: Rule): RuleSeed {
  return {
    id: rule.id,
    name: rule.name,
    conditions: [...rule.conditions],
    result: {
      categoryId: rule.result.categoryId,
      walletId: rule.result.walletId,
      ...(rule.result.ownerMemberId === undefined
        ? {}
        : { ownerMemberId: rule.result.ownerMemberId }),
      ...(rule.result.tagIds?.length ? { tagIds: [...rule.result.tagIds] } : {}),
    },
  };
}

/** `/rules/new?payee=…&categoryId=…`: the editor opened from a row or a suggestion. */
export function newRuleHref(draft: NewRuleDraft): string {
  const params = new URLSearchParams({ payee: draft.payee });
  if (draft.match === 'equals') {
    params.set('match', 'equals');
  }
  if (draft.categoryId) {
    params.set('categoryId', draft.categoryId);
  }
  if (draft.direction) {
    params.set('direction', draft.direction);
  }
  return `/rules/new?${params.toString()}`;
}

/** The draft `newRuleHref` wrote, read back; a blank rule without a payee. */
export function seedFromParams(params: URLSearchParams): RuleSeed {
  const payee = params.get('payee')?.trim();
  if (!payee) {
    return blankSeed();
  }
  const direction = params.get('direction');
  const conditions: RuleCondition[] = [
    {
      field: 'counterparty_name',
      operator: params.get('match') === 'equals' ? 'equals' : 'contains',
      value: payee,
    },
  ];
  if (direction === 'income' || direction === 'expense') {
    conditions.push({ field: 'direction', operator: 'equals', value: direction });
  }
  const categoryId = params.get('categoryId');
  return { id: null, name: '', conditions, result: categoryId ? { categoryId } : {} };
}
