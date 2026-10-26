'use client';

import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { ForecastChart } from '@/app/(main)/forecast/components/ForecastChart';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer, useLocale } from '@/app/i18n';
import type { ForecastResponse } from '@/app/lib/contracts';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';
import { useTodayNote } from './overview-month';
import { KpiCard } from './ui';

/** The forecast page opens on 90 days with no scenario; asking the same shares its cache. */
const FORECAST_PARAMS = { days: 90 };

const fill = (template: string, values: Record<string, string>): string =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
    template,
  );

const formatDate = (date: string): string =>
  formatStoredDateWithOptions(date, { day: 'numeric', month: 'short' });

/** Nothing to project from: no bills, no subscriptions, no history, no balance. */
function isEmptyForecast(data: ForecastResponse): boolean {
  return data.events.length === 0 && data.everydayMonthly === 0 && data.openingBalance === 0;
}

interface SafeToSpendTileProps {
  formatAmount: (value: number) => string;
}

/**
 * What can be spent until the next payday without missing a bill, or for a
 * business how many months the money lasts. The figure the forecast page
 * leads with, a tile here so it is seen without going there.
 */
export function SafeToSpendTile({ formatAmount }: SafeToSpendTileProps): React.JSX.Element | null {
  const t = useIntlayer('forecastPage');
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  // Always the present, whichever month the Overview shows.
  const today = useTodayNote();
  const named = (label: string) => (today ? `${label} · ${today}` : label);
  const { data } = useQuery({
    queryKey: queryKeys.forecast({
      workspaceId,
      days: FORECAST_PARAMS.days,
      scenario: JSON.stringify(FORECAST_PARAMS),
    }),
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: '/forecast',
        params: FORECAST_PARAMS,
        signal,
        contract: 'ForecastResponse',
      }),
    enabled: Boolean(workspaceId),
  });

  // A failed or empty forecast leaves the tile out rather than showing a made-up zero.
  if (!data || isEmptyForecast(data)) {
    return null;
  }

  // The projected balance day by day. Every day counts: a bill is a one-day dip
  // that thinning the line would drop. With room, the forecast page's own chart.
  const spark = { points: data.days.map(day => day.balance) };
  const wideChart =
    data.days.length > 1 ? (
      <ForecastChart days={data.days} formatValue={formatAmount} />
    ) : undefined;
  const details = [
    {
      label: t.lowestBalance.value,
      value: (
        <>
          <PrivateAmount>{formatAmount(data.lowestBalance)}</PrivateAmount> ·{' '}
          {formatDate(data.lowestBalanceDate)}
        </>
      ),
      plain: true,
    },
    {
      label: t.shortfall.value,
      value: data.shortfallDate
        ? fill(t.shortfallOn.value, { date: formatDate(data.shortfallDate) })
        : t.noShortfall.value,
      plain: true,
    },
    ...(data.taxReserve && data.taxReserve > 0
      ? [{ label: t.heldForTax.value, value: formatAmount(data.taxReserve) }]
      : []),
  ];

  if (data.profile === 'business') {
    return (
      <KpiCard
        label={named(t.runway.value)}
        // A number of months, not an amount: it stays readable in privacy mode.
        plainValue
        value={
          data.runwayMonths === null
            ? t.runwayGrowing.value
            : fill(t.runwayMonths.value, {
                months: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
                  data.runwayMonths,
                ),
              })
        }
        tone={
          data.runwayMonths === null ? 'positive' : data.runwayMonths < 3 ? 'negative' : 'neutral'
        }
        href="/forecast"
        spark={spark}
        wideChart={wideChart}
        details={details}
      />
    );
  }

  const { amount, untilDate, nextIncomeDate } = data.safeToSpend;
  return (
    <KpiCard
      label={named(t.safeToSpend.value)}
      value={formatAmount(amount)}
      tone={amount > 0 ? 'positive' : 'negative'}
      caption={fill((nextIncomeDate ? t.safeUntilPayday : t.safeUntil).value, {
        date: formatDate(untilDate),
      })}
      href="/forecast"
      spark={spark}
      wideChart={wideChart}
      details={details}
    />
  );
}
