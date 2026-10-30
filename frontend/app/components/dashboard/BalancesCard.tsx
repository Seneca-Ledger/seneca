'use client';

import AccountBalanceWalletOutlined from '@mui/icons-material/AccountBalanceWalletOutlined';
import type React from 'react';
import { type NetWorthRange, useNetWorthPreset } from '@/app/(main)/net-worth/hooks/useNetWorth';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import { TextTabs } from '@/app/components/ui/text-tabs';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { BalanceGroupRow } from './BalanceGroupRow';
import { monthEndOrToday } from './month-end';
import { CardEmpty, CardLink, DashboardCard } from './ui';

/** The trend windows, shortest first; a fixed span is labelled by Intl. */
const PERIODS: Array<{ range: NetWorthRange; span?: [number, 'month' | 'year'] }> = [
  { range: '30d', span: [1, 'month'] },
  { range: '90d', span: [3, 'month'] },
  { range: '1y', span: [1, 'year'] },
  { range: 'all' },
];

interface BalancesCardProps {
  /** The dashboard's month, `YYYY-MM`: a past one ends the trend on its last day. */
  month: string;
  monthLabel: string;
}

/**
 * Everything owned and owed, by section of the balance sheet: each group with
 * its total and trend, opening onto the lines and accounts inside it.
 */
export function BalancesCard({ month, monthLabel }: BalancesCardProps): React.JSX.Element | null {
  const t = useIntlayer('balancesCard');
  const overview = useIntlayer('overviewTab');
  const netWorthText = useIntlayer('netWorthPage');
  const { locale } = useLocale();
  const asOf = monthEndOrToday(month);
  const { data, isFetching, range, setRange } = useNetWorthPreset('30d', asOf);

  if (!data) {
    return null;
  }

  const whole = (value: number): React.ReactNode => (
    <PrivateAmount title={formatMoney(value, data.currency, locale)}>
      {formatMoney(value, data.currency, locale, { fractionDigits: 0 })}
    </PrivateAmount>
  );
  const formatIn = (value: number, currency: string): string =>
    formatMoney(value, currency, locale, { fractionDigits: 0 });

  const options = PERIODS.map(({ range: value, span }) => ({
    value,
    label: span
      ? new Intl.NumberFormat(locale, {
          style: 'unit',
          unit: span[1],
          unitDisplay: 'short',
        }).format(span[0])
      : netWorthText.rangeAll.value,
  }));

  const sides = [
    {
      side: 'asset',
      label: netWorthText.assets,
      total: data.assetsTotal,
    },
    {
      side: 'liability',
      label: netWorthText.liabilities,
      total: data.liabilitiesTotal,
    },
  ] as const;

  return (
    <DashboardCard
      title={t.title}
      subtitle={asOf ? monthLabel : undefined}
      action={
        <>
          <TextTabs<NetWorthRange>
            value={range}
            options={options}
            onChange={setRange}
            ariaLabel={overview.netWorthPeriod.value}
          />
          <CardLink href="/net-worth">{overview.viewAll}</CardLink>
        </>
      }
    >
      {data.groups.length === 0 ? (
        <CardEmpty icon={AccountBalanceWalletOutlined}>{t.empty}</CardEmpty>
      ) : (
        <div
          className="seneca-dashboard__balances"
          style={{ opacity: isFetching ? 0.6 : 1, transition: 'opacity 150ms ease' }}
        >
          {sides.map(({ side, label, total }) => {
            const groups = data.groups.filter(group => group.side === side);
            if (groups.length === 0) return null;
            return (
              <section key={side} className="seneca-dashboard__balances-side">
                <div className="seneca-dashboard__balances-head">
                  <span>{label}</span>
                  <span>{whole(total)}</span>
                </div>
                <ul className="seneca-dashboard__balances-list">
                  {groups.map(group => (
                    <BalanceGroupRow
                      key={group.key}
                      group={group}
                      name={t.groups[group.key]}
                      formatWhole={whole}
                      formatIn={formatIn}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </DashboardCard>
  );
}
