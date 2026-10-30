'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import Link from 'next/link';
import type React from 'react';
import { useId, useState } from 'react';
import { isDebtType } from '@/app/(main)/accounts/account-types';
import { ChevronRight } from '@/app/components/icons';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import type { NetWorthGroup, WalletItem } from '@/app/lib/contracts';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { Sparkline } from './ui';

/** Sheet lines computed from the accounts: opened, they list the accounts themselves. */
const CASH_LINE = 'ASSET_CASH';
const DEBTS_LINE = 'LIABILITY_ACCOUNT_DEBTS';

interface BalanceGroupRowProps {
  group: NetWorthGroup;
  name: React.ReactNode;
  /** Whole units in the workspace currency. */
  formatWhole: (value: number) => React.ReactNode;
  /** Exact amount in a given currency, for an account held in its own. */
  formatIn: (value: number, currency: string) => string;
}

/** How much the group moved over the window. */
function changeOf(group: NetWorthGroup): number {
  return group.amount - (group.series[0] ?? group.amount);
}

/** Up is good for what is owned and bad for what is owed; no change says nothing. */
function tone(group: NetWorthGroup): 'up' | 'down' | 'flat' {
  const change = changeOf(group);
  if (change === 0) {
    return 'flat';
  }
  return change > 0 === (group.side === 'asset') ? 'up' : 'down';
}

function percentText(value: number | null): string {
  return `${Math.abs(value ?? 0).toFixed(1)}%`;
}

/** One group of the balances card: total and trend, opening onto what it holds. */
export function BalanceGroupRow({
  group,
  name,
  formatWhole,
  formatIn,
}: BalanceGroupRowProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const linesId = useId();
  const workspaceId = useWorkspaceId();
  const needsAccounts = group.lines.some(
    line => line.code === CASH_LINE || line.code === DEBTS_LINE,
  );
  // Same cache as the accounts page; asked only once a group that needs it is opened.
  const { data: wallets } = useQuery({
    queryKey: queryKeys.wallets(workspaceId),
    queryFn: ({ signal }) => apiQueryDecoded({ url: '/wallets', signal, contract: 'WalletList' }),
    enabled: open && needsAccounts && Boolean(workspaceId),
  });

  const accountsFor = (code: string): WalletItem[] =>
    (wallets ?? []).filter(
      wallet =>
        wallet.isActive &&
        wallet.balance !== 0 &&
        (code === DEBTS_LINE
          ? wallet.type === (group.key === 'credit_cards' ? 'credit_card' : 'loan')
          : !isDebtType(wallet.type)),
    );
  const change = changeOf(group);

  const rowTone = tone(group);

  return (
    <li className="seneca-dashboard__balance">
      <button
        type="button"
        className="seneca-dashboard__balance-head"
        aria-expanded={open}
        aria-controls={linesId}
        onClick={() => setOpen(value => !value)}
      >
        <ChevronRight
          size={16}
          className={clsx(
            'seneca-dashboard__balance-chevron',
            open && 'seneca-dashboard__balance-chevron--open',
          )}
          aria-hidden
        />
        <span className="seneca-dashboard__balance-name">{name}</span>
        <span
          className={clsx(
            'seneca-dashboard__balance-spark',
            `seneca-dashboard__balance-trend--${rowTone}`,
          )}
        >
          <Sparkline points={group.series} h={28} w={160} />
        </span>
        <span className="seneca-dashboard__balance-figures">
          <span className="seneca-dashboard__balance-amount">{formatWhole(group.amount)}</span>
          {change !== 0 && (
            <span
              className={clsx(
                'seneca-dashboard__balance-trend',
                `seneca-dashboard__balance-trend--${rowTone}`,
              )}
            >
              {/* From zero a percentage means nothing; the amount that came says it. */}
              {group.changePercent === null ? (
                <>
                  {change > 0 ? '+' : '−'}
                  {formatWhole(Math.abs(change))}
                </>
              ) : (
                <PrivateAmount>{percentText(group.changePercent)}</PrivateAmount>
              )}
            </span>
          )}
        </span>
      </button>
      {open && (
        <ul id={linesId} className="seneca-dashboard__balance-lines">
          {group.lines.flatMap(line => {
            const accounts =
              line.code === CASH_LINE || line.code === DEBTS_LINE ? accountsFor(line.code) : [];
            if (accounts.length === 0) {
              return [
                <li key={line.id}>
                  <Link href="/net-worth" className="seneca-dashboard__balance-line">
                    <span>{line.name}</span>
                    <span>{formatWhole(line.amount)}</span>
                  </Link>
                </li>,
              ];
            }
            return accounts.map(account => (
              <li key={account.id}>
                <Link href={`/accounts/${account.id}`} className="seneca-dashboard__balance-line">
                  <span>{account.name}</span>
                  <PrivateAmount>
                    {formatIn(Math.abs(account.balance), account.currency)}
                  </PrivateAmount>
                </Link>
              </li>
            ));
          })}
        </ul>
      )}
    </li>
  );
}
