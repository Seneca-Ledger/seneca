'use client';

import { useState } from 'react';
import { ActionRow } from '@/app/components/transactions/TransactionActionRow';
import type { Transaction } from '@/app/components/transactions/types';
import { usePermissions } from '@/app/hooks/usePermissions';
import { useIntlayer } from '@/app/i18n';
import { RuleFormDialog } from './RuleFormDialog';
import type { RuleSeed } from './types';

/** A rule draft from a row: its payee as written, and the category it has now. */
function ruleSeedFrom(transaction: Transaction, categoryId: string): RuleSeed {
  return {
    id: null,
    name: '',
    conditions: [
      { field: 'counterparty_name', operator: 'contains', value: transaction.counterpartyName },
    ],
    result: categoryId ? { categoryId } : {},
    priority: 0,
  };
}

/** The drawer's "make a rule from this row" action and the rule form it opens. */
export function RuleFromRowAction({
  transaction,
  categoryId,
}: {
  transaction: Transaction;
  categoryId: string;
}): React.JSX.Element | null {
  const tRules = useIntlayer('categorizationRules');
  const { hasPermission } = usePermissions();
  const [ruleSeed, setRuleSeed] = useState<RuleSeed | null>(null);
  // Another member's private row shows a placeholder for the payee: nothing to match on.
  const canMakeRule =
    hasPermission('category.edit') &&
    !transaction.isPrivate &&
    Boolean(transaction.counterpartyName);
  if (!canMakeRule) {
    return null;
  }
  return (
    <>
      <ActionRow
        label={tRules.drawer.createFromRow.value}
        hint={tRules.drawer.createFromRowHint}
        onClick={() => setRuleSeed(ruleSeedFrom(transaction, categoryId))}
      />
      {ruleSeed && <RuleFormDialog open seed={ruleSeed} onClose={() => setRuleSeed(null)} />}
    </>
  );
}
