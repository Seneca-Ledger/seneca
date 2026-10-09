'use client';

import type React from 'react';
import { NetWorthChart } from '@/app/(main)/net-worth/components/NetWorthChart';
import { type NetWorthRange, useNetWorthPreset } from '@/app/(main)/net-worth/hooks/useNetWorth';
import { formatSignedAmount } from '@/app/components/charts/chart-format';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { COMPACT_SELECT_SX, Select } from '@/app/components/ui/select';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { CardLink, DashboardCard } from './ui';

/**
 * The periods the dropdown offers, shortest first. A fixed span is labelled
 * `3 months` / `1 year` by Intl in the user's language; the other two have words.
 */
const PERIODS: Array<{ range: NetWorthRange; span?: [number, 'month' | 'year'] }> = [
  { range: '30d', span: [1, 'month'] },
  { range: '90d', span: [3, 'month'] },
  { range: '180d', span: [6, 'month'] },
  { range: 'ytd' },
  { range: '1y', span: [1, 'year'] },
  { range: 'all' },
];

/**
 * Net worth over a period the user picks, as the net worth page draws it. Unlike
 * the rest of the overview it does not follow the month strip: net worth is a
 * running total, and the interesting question is how it moved over a span.
 */
export function NetWorthCard(): React.JSX.Element | null {
  const t = useIntlayer('overviewTab');
  const netWorthText = useIntlayer('netWorthPage');
  const { locale } = useLocale();
  const { data, isFetching, range, setRange } = useNetWorthPreset('30d');

  // Until the first answer is in there is nothing honest to draw; a failed
  // request says nothing either. A period switch keeps the previous figures.
  if (!data) {
    return null;
  }

  const money = (value: number): string => formatMoney(value, data.currency, locale);
  const isPositive = data.change >= 0;
  const hasData = data.assetsTotal !== 0 || data.liabilitiesTotal !== 0;

  const options = PERIODS.map(({ range: value, span }) => ({
    value,
    label: span
      ? new Intl.NumberFormat(locale, { style: 'unit', unit: span[1], unitDisplay: 'long' }).format(
          span[0],
        )
      : value === 'ytd'
        ? t.netWorthYearToDate.value
        : netWorthText.rangeAll.value,
  }));

  return (
    <DashboardCard
      title={netWorthText.title}
      action={
        <>
          <Select
            size="small"
            value={range}
            options={options}
            onChange={value => setRange(value as NetWorthRange)}
            inputProps={{ 'aria-label': t.netWorthPeriod.value }}
            sx={COMPACT_SELECT_SX}
          />
          <CardLink href="/net-worth">{t.viewAll}</CardLink>
        </>
      }
    >
      <div style={{ opacity: isFetching ? 0.6 : 1, transition: 'opacity 150ms ease' }}>
        <div className="lumio-chart__total">{money(data.current)}</div>
        <div className="lumio-chart__breakdown">
          <span
            className={
              isPositive ? 'lumio-chart__breakdown-income' : 'lumio-chart__breakdown-expense'
            }
          >
            {formatSignedAmount(data.change, money)}
            {data.changePercent != null &&
              ` (${isPositive ? '+' : '−'}${Math.abs(data.changePercent)}%)`}
          </span>{' '}
          {netWorthText.overPeriod}
        </div>
        {hasData ? (
          <NetWorthChart
            points={data.series}
            positive={isPositive}
            view="performance"
            formatValue={money}
            labels={{
              assets: netWorthText.assets.value,
              liabilities: netWorthText.liabilities.value,
              net: netWorthText.title.value,
            }}
          />
        ) : (
          <EmptyState illustration="net-worth" size="sm" compact description={netWorthText.empty} />
        )}
      </div>
    </DashboardCard>
  );
}
