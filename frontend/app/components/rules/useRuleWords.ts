'use client';

import { useIntlayer } from '@/app/i18n';
import type { RuleWords } from './rule-text';

/** The page's words for fields, checks and actions, as strings the helpers can join. */
export function useRuleWords(): RuleWords {
  const t = useIntlayer('categorizationRules');
  const types = useIntlayer('paymentTypes');
  return {
    field: {
      counterparty_name: t.field.counterparty_name.value,
      payment_purpose: t.field.payment_purpose.value,
      amount: t.field.amount.value,
      owner: t.field.owner.value,
      counterparty_bin: t.field.counterparty_bin.value,
      document_number: t.field.document_number.value,
      direction: t.field.direction.value,
      payment_type: t.field.payment_type.value,
      wallet: t.field.wallet.value,
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
    direction: { income: t.direction.income.value, expense: t.direction.expense.value },
    paymentType: {
      card: types.card.value,
      bank_transfer_in: types.bank_transfer_in.value,
      bank_transfer_out: types.bank_transfer_out.value,
      direct_debit: types.direct_debit.value,
      standing_order: types.standing_order.value,
      cash: types.cash.value,
      fee: types.fee.value,
      interest: types.interest.value,
    },
    and: t.page.and.value,
    category: t.result.category.value,
    wallet: t.result.wallet.value,
    owner: t.result.owner.value,
    tags: t.result.tags.value,
    shared: t.result.shared.value,
    unknown: t.result.unknown.value,
  };
}
