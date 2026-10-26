import { fillTemplateNodes } from '@/app/components/ui/private-amount';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import type { Account } from '../hooks/useAccounts';
import { formatDay, mutedStyle } from './account-detail-styles';

/** Whether the books agree with the bank, said once, under the balance. */
export function AccountReconciliation({ account }: { account: Account }): React.JSX.Element | null {
  const t = useIntlayer('accountsPage');
  const { locale } = useLocale();
  const reconciliation = account.reconciliation;
  if (account.pendingReviewCount > 0) {
    return (
      <span style={mutedStyle}>
        {t.pendingReview.value.replace('{{count}}', String(account.pendingReviewCount))}
      </span>
    );
  }
  if (!reconciliation) {
    return null;
  }
  const dot = (
    <span
      aria-hidden
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        flexShrink: 0,
        background: reconciliation.matches ? 'var(--money-up)' : 'var(--attention)',
      }}
    />
  );
  return (
    <span style={{ ...mutedStyle, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {dot}
      <span>
        {reconciliation.matches
          ? t.matches.value.replace('{{date}}', formatDay(reconciliation.date, locale))
          : fillTemplateNodes(t.mismatch.value, {
              amount: formatMoney(
                Math.abs(reconciliation.statementBalance - reconciliation.computedBalance),
                account.currency,
                locale,
              ),
            })}
      </span>
    </span>
  );
}
