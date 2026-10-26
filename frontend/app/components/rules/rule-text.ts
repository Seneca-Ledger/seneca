import type { RuleCondition, RuleDraftBody } from './types';

/** Puts values into a translated line: `fill('Matched {count} times', { count: 3 })`. */
export function fill(text: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (line, [key, value]) => line.split(`{${key}}`).join(String(value)),
    text,
  );
}

/** The words the page uses for fields, checks and actions, as plain strings. */
export interface RuleWords {
  field: Record<RuleCondition['field'], string>;
  operator: Record<RuleCondition['operator'], string>;
  and: string;
  category: string;
  wallet: string;
  owner: string;
  shared: string;
  unknown: string;
}

/** `Payee contains "acme" and Amount is more than 20`, for the list and a default name. */
export function describeConditions(
  conditions: readonly RuleCondition[],
  words: RuleWords,
  ownerName: (memberId: string) => string | null,
): string {
  return conditions
    .map(condition => {
      const value =
        condition.field === 'owner'
          ? (ownerName(String(condition.value)) ?? words.unknown)
          : condition.field === 'amount'
            ? String(condition.value)
            : `“${condition.value}”`;
      return `${words.field[condition.field]} ${words.operator[condition.operator]} ${value}`;
    })
    .join(` ${words.and} `);
}

/** `file under Groceries · account Main card`: what a matching row gets. */
export function describeResult(
  result: RuleDraftBody['result'],
  words: RuleWords,
  names: {
    category: (id: string) => string | null;
    wallet: (id: string) => string | null;
    owner: (memberId: string) => string | null;
  },
): string {
  const parts: string[] = [];
  if (result.categoryId) {
    parts.push(fill(words.category, { name: names.category(result.categoryId) ?? words.unknown }));
  }
  if (result.walletId) {
    parts.push(fill(words.wallet, { name: names.wallet(result.walletId) ?? words.unknown }));
  }
  if (result.ownerMemberId !== undefined) {
    const owner =
      result.ownerMemberId === null
        ? words.shared
        : (names.owner(result.ownerMemberId) ?? words.unknown);
    parts.push(fill(words.owner, { name: owner }));
  }
  return parts.join(' · ');
}
