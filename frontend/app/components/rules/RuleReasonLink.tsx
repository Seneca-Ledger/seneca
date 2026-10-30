'use client';

import NextLink from 'next/link';
import { useIntlayer } from '@/app/i18n';
import { fill } from './rule-text';
import { useRulesList } from './useRules';

/**
 * "Filed by the rule …" under a row's category. A row keeps the rule's name,
 * not its id, so the link finds the rule by name; a renamed or ambiguous one
 * leads to the list instead.
 */
export function RuleReasonLink({ name }: { name: string }) {
  const t = useIntlayer('categorizationRules');
  const named = (useRulesList().data?.data ?? []).filter(rule => rule.name === name);
  const href = named.length === 1 ? `/rules/${named[0].id}` : '/rules';
  return (
    <NextLink href={href} className="seneca-tx-detail__rule-link">
      {fill(t.drawer.fromRule.value, { name })}
    </NextLink>
  );
}
