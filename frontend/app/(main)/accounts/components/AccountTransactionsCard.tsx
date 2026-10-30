import { PrivateAmount } from '@/app/components/ui/private-amount';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import type { useAccount } from '../hooks/useAccounts';
import {
  cardStyle,
  figureStyle,
  formatDay,
  listRowStyle,
  mutedStyle,
  titleStyle,
} from './account-detail-styles';

/** The account's latest rows, each with the balance after it. */
export function AccountTransactionsCard({
  transactions,
  money,
}: {
  transactions: ReturnType<typeof useAccount>['transactions'];
  /** An amount in the account's currency. */
  money: (value: number) => string;
}): React.JSX.Element {
  const t = useIntlayer('accountsPage');
  const { locale } = useLocale();
  return (
    <section style={cardStyle}>
      <h2 style={titleStyle}>{t.transactionsTitle}</h2>
      {transactions.length === 0 ? (
        <span style={mutedStyle}>{t.noTransactions}</span>
      ) : (
        <div>
          {transactions.map(row => {
            const amount = Number(row.credit ?? 0) - Number(row.debit ?? 0);
            const other = row.transferPairWallet?.name;
            return (
              <div key={row.id} style={listRowStyle}>
                <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 14,
                      color: 'var(--foreground)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {other
                      ? t.transferWith.value.replace('{{account}}', other)
                      : row.counterpartyName}
                  </span>
                  <span style={mutedStyle}>{formatDay(row.transactionDate, locale)}</span>
                </span>
                <span style={{ display: 'grid', gap: 2, justifyItems: 'end' }}>
                  <span style={figureStyle}>
                    <PrivateAmount>{formatMoney(amount, row.currency, locale)}</PrivateAmount>
                  </span>
                  {row.runningBalance && (
                    <span style={{ ...mutedStyle, fontVariantNumeric: 'tabular-nums' }}>
                      <PrivateAmount>{money(Number(row.runningBalance))}</PrivateAmount>
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
