import type { PaymentType } from '@/app/lib/contracts';
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
  direction: Record<'income' | 'expense', string>;
  paymentType: Record<PaymentType, string>;
  and: string;
  category: string;
  wallet: string;
  owner: string;
  tags: string;
  shared: string;
  unknown: string;
}

/** How the ids a rule names are shown: by the name of what they point at. */
export interface RuleNames {
  category: (id: string) => string | null;
  wallet: (id: string) => string | null;
  owner: (memberId: string) => string | null;
  tag: (id: string) => string | null;
}

function conditionValue(condition: RuleCondition, words: RuleWords, names: RuleNames): string {
  const value = String(condition.value);
  switch (condition.field) {
    case 'owner':
      return names.owner(value) ?? words.unknown;
    case 'wallet':
      return names.wallet(value) ?? words.unknown;
    case 'direction':
      return value === 'income' || value === 'expense' ? words.direction[value] : value;
    case 'payment_type':
      return words.paymentType[value as PaymentType] ?? value;
    case 'amount':
      return value;
    default:
      return `“${value}”`;
  }
}

/** `Payee contains "acme" and Amount is more than 20`, for the list and a default name. */
export function describeConditions(
  conditions: readonly RuleCondition[],
  words: RuleWords,
  names: RuleNames,
): string {
  return conditions
    .map(
      condition =>
        `${words.field[condition.field]} ${words.operator[condition.operator]} ${conditionValue(condition, words, names)}`,
    )
    .join(` ${words.and} `);
}

/** `file under Groceries · account Main card · tag Gadgets`: what a matching row gets. */
export function describeResult(
  result: RuleDraftBody['result'],
  words: RuleWords,
  names: RuleNames,
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
  if (result.tagIds?.length) {
    const tags = result.tagIds.map(id => names.tag(id) ?? words.unknown).join(', ');
    parts.push(fill(words.tags, { names: tags }));
  }
  return parts.join(' · ');
}
