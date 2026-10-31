'use client';

import { useRouter } from 'next/navigation';
import { ActionRow } from '@/app/components/transactions/TransactionActionRow';
import type { Transaction } from '@/app/components/transactions/types';
import { usePermissions } from '@/app/hooks/usePermissions';
import { useIntlayer } from '@/app/i18n';
import { newRuleHref } from './rule-seed';

/** What a rule is drafted from: a row, or a receipt's vendor (no direction). */
type RuleSource = Pick<Transaction, 'counterpartyName' | 'isPrivate'> &
  Partial<Pick<Transaction, 'transactionType'>>;

/**
 * The drawer's "make a rule from this row" action: the rule editor, filled in
 * with the payee as the bank wrote it, the row's direction and its category.
 */
export function RuleFromRowAction({
  transaction,
  categoryId,
}: {
  transaction: RuleSource;
  categoryId: string;
}): React.JSX.Element | null {
  const tRules = useIntlayer('categorizationRules');
  const router = useRouter();
  const { hasPermission } = usePermissions();
  // Another member's private row shows a placeholder for the payee: nothing to match on.
  const canMakeRule =
    hasPermission('category.edit') &&
    !transaction.isPrivate &&
    Boolean(transaction.counterpartyName);
  if (!canMakeRule) {
    return null;
  }
  return (
    <ActionRow
      label={tRules.drawer.createFromRow.value}
      hint={tRules.drawer.createFromRowHint}
      onClick={() =>
        router.push(
          newRuleHref({
            payee: transaction.counterpartyName,
            categoryId: categoryId || undefined,
            direction:
              transaction.transactionType === 'income' || transaction.transactionType === 'expense'
                ? transaction.transactionType
                : undefined,
          }),
        )
      }
    />
  );
}
