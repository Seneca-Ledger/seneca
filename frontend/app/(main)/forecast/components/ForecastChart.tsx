'use client';

import { ChartRangeFooter } from '@/app/components/charts/ChartParts';
import { formatDayLabel } from '@/app/components/charts/chart-format';
import { LazyNetWorthArea } from '@/app/components/charts/lazy-charts';
import { useLocale } from '@/app/i18n';
import type { ForecastDay, ForecastEvent } from '../hooks/useForecast';

interface ForecastChartProps {
  days: ForecastDay[];
  /** The dated items behind the curve: named in the tooltip, the biggest one on the line. */
  events?: ForecastEvent[];
  /** The lowest point, marked with a dot and a dashed level. */
  lowest?: { date: string; value: number };
  formatValue: (value: number) => string;
  /** Labels for three value lines; a small tile leaves them, and the marks, out. */
  formatTick?: (value: number) => string;
}

/**
 * The projected balance, coloured by whether it ends above where it started,
 * with what explains its shape marked on it: the lowest point, as a dot and a
 * dashed level, and the biggest single payment, so a drop is never a mystery.
 */
export function ForecastChart({
  days,
  events = [],
  lowest,
  formatValue,
  formatTick,
}: ForecastChartProps) {
  const { locale } = useLocale();
  const points = days.map(day => ({ date: day.date, value: day.balance }));
  const positive = days.length === 0 || days[days.length - 1].balance >= 0;
  const signed = (amount: number) => `${amount > 0 ? '+' : '−'}${formatValue(Math.abs(amount))}`;
  const biggest = events.reduce<ForecastEvent | null>(
    (worst, event) => (event.amount < 0 && (!worst || event.amount < worst.amount) ? event : worst),
    null,
  );
  const markers = [
    ...(lowest ? [{ date: lowest.date }] : []),
    ...(biggest && biggest.date !== lowest?.date
      ? [{ date: biggest.date, label: `${biggest.label} ${signed(biggest.amount)}` }]
      : []),
  ];

  return (
    <>
      <div className="seneca-chart__box">
        <LazyNetWorthArea
          points={points}
          positive={positive}
          locale={locale}
          formatValue={formatValue}
          formatTick={formatTick}
          markers={markers}
          floor={lowest?.value}
          describeDay={date =>
            events
              .filter(event => event.date === date)
              .map(event => ({ label: event.label, value: signed(event.amount) }))
          }
        />
      </div>
      {points.length > 1 && (
        <ChartRangeFooter
          start={formatDayLabel(points[0].date, locale)}
          end={formatDayLabel(points[points.length - 1].date, locale)}
        />
      )}
    </>
  );
}
