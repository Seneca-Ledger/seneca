'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type React from 'react';
import { TokenIcon } from '@/app/(main)/crypto/components/TokenIcon';
import { ChevronRight } from '@/app/components/icons';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer, useLocale } from '@/app/i18n';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { useIsWideSection } from './section-span';

/** Holdings the card lists with the row to itself; the rest are on the crypto page. */
const WIDE_HOLDINGS = 8;
/** Holdings listed under the value when the card shares its row. */
const HALF_HOLDINGS = 5;

type CryptoPortfolioCardProps = {
  formatAmount: (value: number) => string;
  /** The dashboard's month as `YYYY-MM`; the in/out line follows it. */
  month: string;
  monthLabel: string;
};

/**
 * What the wallets are worth right now, plus how much crypto came in and went out
 * in the month the dashboard is showing — so months can be compared. The value is
 * always today's (past balances are not reconstructed); the flows are booked at
 * the rate on the transfer date. Shown only once a wallet exists.
 */
export function CryptoPortfolioCard({
  formatAmount,
  month,
  monthLabel,
}: CryptoPortfolioCardProps): React.JSX.Element | null {
  const workspaceId = useWorkspaceId();
  const t = useIntlayer('cryptoPage');
  const { locale } = useLocale();
  const wide = useIsWideSection();
  // Cached, so the card is drawn at once when Overview is opened again. The
  // dashboard must render without crypto: a failed request just leaves it hidden.
  const { data: summary } = useQuery({
    queryKey: queryKeys.cryptoMonthSummary(workspaceId, month),
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: '/crypto/summary',
        params: { month },
        signal,
        contract: 'CryptoSummary',
      }),
    enabled: Boolean(workspaceId),
    // Another month keeps the card in place until its figures arrive.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2] === workspaceId ? previous : undefined,
  });

  if (!summary || summary.walletCount === 0) {
    return null;
  }

  const change = summary.portfolioChangeSinceYesterday;
  const coins = new Intl.NumberFormat(locale, { maximumFractionDigits: 6 });
  const percent = (value: number) => `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(1)}%`;

  const holdings = summary.holdings.slice(0, wide ? WIDE_HOLDINGS : HALF_HOLDINGS);

  const overview = (
    <div>
      <div className="lumio-dashboard__card-sub">{t.portfolio}</div>
      <div className="lumio-dashboard__stat-value" style={VALUE_STYLE}>
        {formatAmount(summary.portfolioValue)}
      </div>
      {change !== null && (
        <div className="lumio-dashboard__card-sub">
          <span
            className={
              change >= 0
                ? 'lumio-dashboard__amount--positive'
                : 'lumio-dashboard__amount--negative'
            }
          >
            {percent(change)}
          </span>{' '}
          {t.sinceYesterday}
        </div>
      )}
      <div className="lumio-dashboard__card-sub">
        {monthLabel} ·{' '}
        <span className="lumio-dashboard__amount--positive">+{formatAmount(summary.income)}</span> ·{' '}
        <span className="lumio-dashboard__amount--negative">−{formatAmount(summary.expense)}</span>
      </div>
    </div>
  );

  // What is held, and how each coin is doing.
  const table = holdings.length > 0 && (
    <table
      className={
        wide
          ? 'lumio-dashboard__holdings'
          : 'lumio-dashboard__holdings lumio-dashboard__holdings--stacked'
      }
    >
      <thead>
        <tr>
          <th>{t.asset}</th>
          <th>{t.amount}</th>
          <th>{t.worth}</th>
          <th>{t.unrealized}</th>
        </tr>
      </thead>
      <tbody>
        {holdings.map(holding => (
          <tr key={holding.asset}>
            <td>
              <span className="lumio-dashboard__holdings-asset">
                <TokenIcon asset={holding.asset} size={16} />
                {holding.asset}
              </span>
            </td>
            <td>{coins.format(Number(holding.amount))}</td>
            <td>{formatAmount(holding.value)}</td>
            <td
              className={
                holding.unrealizedPercent === null
                  ? undefined
                  : holding.unrealizedPercent >= 0
                    ? 'lumio-dashboard__amount--positive'
                    : 'lumio-dashboard__amount--negative'
              }
            >
              {holding.unrealizedPercent === null ? '—' : percent(holding.unrealizedPercent)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  // With the row to itself the table sits beside the value; sharing a row it
  // goes underneath, so the card fills the height its neighbour gives it.
  if (!wide) {
    return (
      <Link href="/crypto" className="lumio-dashboard__card" style={STACKED_CARD_STYLE}>
        <div style={HEAD_STYLE}>
          {overview}
          <ChevronRight size={18} />
        </div>
        {table}
      </Link>
    );
  }

  return (
    <Link href="/crypto" className="lumio-dashboard__card" style={CARD_STYLE}>
      {overview}
      {table}
      <ChevronRight size={18} />
    </Link>
  );
}

// The card class lays its children out in a column; this one reads as a row, with
// the value against the left edge and the chevron against the right.
const CARD_STYLE = {
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  textDecoration: 'none',
} as const;

const STACKED_CARD_STYLE = { gap: 16, textDecoration: 'none' } as const;

const HEAD_STYLE = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 16,
} as const;

const VALUE_STYLE = { fontSize: 22 } as const;
