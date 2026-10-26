'use client';

import { useIntlayer } from '@/app/i18n';
import type { RuleWords } from './rule-text';

/** The page's words for fields, checks and actions, as strings the helpers can join. */
export function useRuleWords(): RuleWords {
  const t = useIntlayer('categorizationRules');
  return {
    field: {
      counterparty_name: t.field.counterparty_name.value,
      payment_purpose: t.field.payment_purpose.value,
      amount: t.field.amount.value,
      owner: t.field.owner.value,
      counterparty_bin: t.field.counterparty_bin.value,
      document_number: t.field.document_number.value,
    },
    operator: {
      contains: t.operator.contains.value,
      equals: t.operator.equals.value,
      starts_with: t.operator.starts_with.value,
      ends_with: t.operator.ends_with.value,
      greater_than: t.operator.greater_than.value,
      less_than: t.operator.less_than.value,
      regex: t.operator.regex.value,
    },
    and: t.page.and.value,
    category: t.result.category.value,
    wallet: t.result.wallet.value,
    owner: t.result.owner.value,
    shared: t.result.shared.value,
    unknown: t.result.unknown.value,
  };
}
