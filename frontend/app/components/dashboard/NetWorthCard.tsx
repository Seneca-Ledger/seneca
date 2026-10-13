'use client';

import AccountBalanceOutlined from '@mui/icons-material/AccountBalanceOutlined';
import type React from 'react';
import { ASSET_CLASS_KEYS } from '@/app/(main)/net-worth/components/InvestmentsCard';
import { NetWorthChart } from '@/app/(main)/net-worth/components/NetWorthChart';
import { type NetWorthRange, useNetWorth } from '@/app/(main)/net-worth/hooks/useNetWorth';
import { formatSignedAmount } from '@/app/components/charts/chart-format';
import { COMPACT_SELECT_SX, Select } from '@/app/components/ui/select';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { useIsWideSection } from './section-span';
import { CardEmpty, CardLink, DashboardCard } from './ui';

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
  const { data, isFetching, range, setRange } = useNetWorth('30d');
  const wide = useIsWideSection();

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
        {hasData && wide ? (
          // With the row to itself: what the total is made of, beside the line.
          <div className="lumio-dashboard__chart-aside">
            <div className="lumio-dashboard__chart-aside-main">
              <NetWorthChart points={data.series} positive={isPositive} formatValue={money} />
            </div>
            <div className="lumio-dashboard__chart-aside-side">
              <dl className="lumio-dashboard__stat-details">
                <div>
                  <dt>{netWorthText.assets}</dt>
                  <dd>{money(data.assetsTotal)}</dd>
                </div>
                <div>
                  <dt>{netWorthText.liabilities}</dt>
                  <dd>{money(data.liabilitiesTotal)}</dd>
                </div>
              </dl>
              {data.allTimeHigh && (
                <p className="lumio-dashboard__card-sub">
                  {String(netWorthText.allTimeHigh.value)
                    .replace('{{value}}', money(data.allTimeHigh.value))
                    .replace('{{date}}', data.allTimeHigh.date)}
                </p>
              )}
              {data.byAssetClass.length > 0 && (
                <>
                  <div className="lumio-dashboard__card-sub">{netWorthText.assetClasses}</div>
                  <dl className="lumio-dashboard__stat-details">
                    {data.byAssetClass.map(item => {
                      const key =
                        ASSET_CLASS_KEYS[(item.key ?? 'other') as keyof typeof ASSET_CLASS_KEYS] ??
                        ASSET_CLASS_KEYS.other;
                      return (
                        <div key={item.key ?? 'other'}>
                          <dt>{netWorthText[key as 'classOther'].value}</dt>
                          <dd>
                            {money(item.amount)} · {Math.round(item.percent)}%
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </>
              )}
            </div>
          </div>
        ) : hasData ? (
          <NetWorthChart points={data.series} positive={isPositive} formatValue={money} />
        ) : (
          <CardEmpty icon={AccountBalanceOutlined}>{netWorthText.empty}</CardEmpty>
        )}
      </div>
    </DashboardCard>
  );
}
