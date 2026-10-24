'use client';

import Link from 'next/link';
import { fillTemplateNodes, PrivateAmount } from '@/app/components/ui/private-amount';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { tokens } from '@/lib/theme-tokens';
import { accountIconOf, accountSubtitle, isDebtType } from '../account-types';
import type { Account } from '../hooks/useAccounts';

const formatDay = (date: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(date));

/** The balance as a person reads it: a debt is "€1,200 owed", not "−€1,200". */
export function AccountBalance({
  account,
  size = 15,
}: {
  account: Pick<Account, 'type' | 'balance' | 'currency'>;
  size?: number;
}): React.JSX.Element {
  const t = useIntlayer('accountsPage');
  const { locale } = useLocale();
  const style = {
    fontSize: size,
    fontWeight: 500,
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--foreground)',
  } as const;
  if (isDebtType(account.type) && account.balance < 0) {
    return (
      <span style={style}>
        {fillTemplateNodes(t.owed.value, {
          amount: formatMoney(-account.balance, account.currency, locale),
        })}
      </span>
    );
  }
  return (
    <span style={style}>
      <PrivateAmount>{formatMoney(account.balance, account.currency, locale)}</PrivateAmount>
    </span>
  );
}

/**
 * The quiet line under a balance. Nothing to say means the date of the latest
 * row; a statement that disagrees with the books is the one thing in colour.
 */
export function AccountStatusLine({ account }: { account: Account }): React.JSX.Element | null {
  const t = useIntlayer('accountsPage');
  const { locale } = useLocale();
  const muted = { fontSize: 13, color: 'var(--text-muted)' } as const;

  if (account.pendingReviewCount > 0) {
    return (
      <span style={muted}>
        {t.pendingReview.value.replace('{{count}}', String(account.pendingReviewCount))}
      </span>
    );
  }
  const reconciliation = account.reconciliation;
  if (reconciliation && !reconciliation.matches) {
    const difference = Math.abs(reconciliation.statementBalance - reconciliation.computedBalance);
    return (
      <span style={{ ...muted, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--attention)',
            flexShrink: 0,
          }}
        />
        <span>
          {fillTemplateNodes(t.mismatch.value, {
            amount: formatMoney(difference, account.currency, locale),
          })}
        </span>
      </span>
    );
  }
  if (account.lastActivityAt) {
    return (
      <span style={muted}>
        {t.asOf.value.replace('{{date}}', formatDay(account.lastActivityAt, locale))}
      </span>
    );
  }
  return <span style={muted}>{t.noActivity}</span>;
}

/** The type's line icon in the neutral circle, as on budgets and crypto tokens. */
export function AccountBadge({
  type,
  size = 36,
}: {
  type: Account['type'];
  size?: number;
}): React.JSX.Element {
  const Icon = accountIconOf(type);
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--icon-badge-bg)',
        color: 'var(--text-muted)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon size={Math.round(size / 2)} />
    </span>
  );
}

export function AccountRow({ account }: { account: Account }): React.JSX.Element {
  const subtitle = accountSubtitle(account);
  return (
    <Link
      href={`/accounts/${account.id}`}
      className="seneca-account-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        textDecoration: 'none',
        color: 'inherit',
        borderRadius: tokens.radius.sm,
        opacity: account.isActive ? 1 : 0.6,
      }}
    >
      <AccountBadge type={account.type} />
      <span style={{ display: 'grid', gap: 2, minWidth: 0, flex: 1 }}>
        <span
          style={{
            fontSize: 15,
            fontWeight: 500,
            color: 'var(--foreground)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {account.name}
        </span>
        {subtitle && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{subtitle}</span>}
      </span>
      <span style={{ display: 'grid', gap: 2, justifyItems: 'end', textAlign: 'right' }}>
        <AccountBalance account={account} />
        <AccountStatusLine account={account} />
      </span>
    </Link>
  );
}
