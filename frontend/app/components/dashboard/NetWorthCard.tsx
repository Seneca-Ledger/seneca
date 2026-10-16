'use client';

import AccountBalanceOutlined from '@mui/icons-material/AccountBalanceOutlined';
import type React from 'react';
import { ASSET_CLASS_KEYS } from '@/app/(main)/net-worth/components/InvestmentsCard';
import { NetWorthChart } from '@/app/(main)/net-worth/components/NetWorthChart';
import { type NetWorthRange, useNetWorth } from '@/app/(main)/net-worth/hooks/useNetWorth';
import { formatSignedAmount } from '@/app/components/charts/chart-format';
import { TextTabs } from '@/app/components/ui/text-tabs';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';
import { monthEndOrToday } from './month-end';
import { useIsWideSection } from './section-span';
import { CardEmpty, CardLink, DashboardCard } from './ui';

/**
 * The periods the tabs offer, shortest first. A fixed span is labelled short
 * (`1 mo`, `1 yr`) by Intl in the user's language; the other two have words.
 */
const PERIODS: Array<{ range: NetWorthRange; span?: [number, 'month' | 'year'] }> = [
  { range: '30d', span: [1, 'month'] },
  { range: '90d', span: [3, 'month'] },
  { range: '180d', span: [6, 'month'] },
  { range: 'ytd' },
  { range: '1y', span: [1, 'year'] },
  { range: 'all' },
];

interface NetWorthCardProps {
  /** The dashboard's month, `YYYY-MM`: a past one ends the period on its last day. */
  month: string;
  monthLabel: string;
}

/**
 * Net worth over a period the user picks, as the net worth page draws it,
 * ending today, or on the last day of the month the overview shows.
 */
export function NetWorthCard({ month, monthLabel }: NetWorthCardProps): React.JSX.Element | null {
  const t = useIntlayer('overviewTab');
  const netWorthText = useIntlayer('netWorthPage');
  const { locale } = useLocale();
  const asOf = monthEndOrToday(month);
  const { data, isFetching, range, setRange } = useNetWorth('30d', asOf);
  const wide = useIsWideSection();

  // Until the first answer is in there is nothing honest to draw; a failed
  // request says nothing either. A period switch keeps the previous figures.
  if (!data) {
    return null;
  }

  const money = (value: number): string => formatMoney(value, data.currency, locale);
  // On the overview a large sum reads in whole units; the cents wait in the tooltip.
  const whole = (value: number): React.ReactNode => (
    <span title={money(value)}>
      {formatMoney(value, data.currency, locale, { fractionDigits: 0 })}
    </span>
  );
  const shortDate = (date: string): string =>
    formatStoredDateWithOptions(date, { day: 'numeric', month: 'short' });
  const tick = (value: number): string =>
    formatMoney(value, data.currency, locale, { notation: 'compact' });
  const start = data.series[0]?.date;
  const isPositive = data.change >= 0;
  const hasData = data.assetsTotal !== 0 || data.liabilitiesTotal !== 0;

  const options = PERIODS.map(({ range: value, span }) => ({
    value,
    label: span
      ? new Intl.NumberFormat(locale, {
          style: 'unit',
          unit: span[1],
          unitDisplay: 'short',
        }).format(span[0])
      : value === 'ytd'
        ? t.netWorthYearToDate.value
        : netWorthText.rangeAll.value,
  }));

  return (
    <DashboardCard
      title={netWorthText.title}
      subtitle={asOf ? monthLabel : undefined}
      action={
        <>
          <TextTabs<NetWorthRange>
            value={range}
            options={options}
            onChange={setRange}
            ariaLabel={t.netWorthPeriod.value}
          />
          <CardLink href="/net-worth">{t.viewAll}</CardLink>
        </>
      }
    >
      <div style={{ opacity: isFetching ? 0.6 : 1, transition: 'opacity 150ms ease' }}>
        <div className="lumio-chart__total">{whole(data.current)}</div>
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
          {/* Against a named day, not "the period". */}
          {start
            ? String(t.netWorthVsDate.value).replace('{{date}}', shortDate(start))
            : netWorthText.overPeriod}
        </div>
        {hasData && wide ? (
          // With the row to itself: what the total is made of, beside the line.
          <div className="lumio-dashboard__chart-aside">
            <div className="lumio-dashboard__chart-aside-main">
              <NetWorthChart
                points={data.series}
                positive={isPositive}
                formatValue={money}
                formatTick={tick}
              />
            </div>
            <div className="lumio-dashboard__chart-aside-side">
              <dl className="lumio-dashboard__stat-details">
                <div>
                  <dt>{netWorthText.assets}</dt>
                  <dd>{whole(data.assetsTotal)}</dd>
                </div>
                <div>
                  <dt>{netWorthText.liabilities}</dt>
                  <dd>{whole(data.liabilitiesTotal)}</dd>
                </div>
              </dl>
              {/* At the peak the high is today's figure again: said in words. */}
              {data.allTimeHigh && (
                <p className="lumio-dashboard__card-sub">
                  {Math.round(data.allTimeHigh.value) === Math.round(data.current)
                    ? t.netWorthAtHigh
                    : String(netWorthText.allTimeHigh.value)
                        .replace(
                          '{{value}}',
                          formatMoney(data.allTimeHigh.value, data.currency, locale, {
                            fractionDigits: 0,
                          }),
                        )
                        .replace('{{date}}', shortDate(data.allTimeHigh.date))}
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
                            {whole(item.amount)} · {Math.round(item.percent)}%
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
          <NetWorthChart
            points={data.series}
            positive={isPositive}
            formatValue={money}
            formatTick={tick}
          />
        ) : (
          <CardEmpty icon={AccountBalanceOutlined}>{netWorthText.empty}</CardEmpty>
        )}
      </div>
    </DashboardCard>
  );
}
