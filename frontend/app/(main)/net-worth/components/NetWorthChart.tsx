'use client';

import { ChartRangeFooter } from '@/app/components/charts/ChartParts';
import { formatDayLabel } from '@/app/components/charts/chart-format';
import { LazyNetWorthArea, LazyNetWorthBreakdown } from '@/app/components/charts/lazy-charts';
import { useLocale } from '@/app/i18n';
import type { NetWorthPoint, NetWorthView } from '../hooks/useNetWorth';

interface NetWorthChartProps {
  points: NetWorthPoint[];
  /** Colours the line: growth reads as success, decline as danger. */
  positive: boolean;
  /** The net line, or the two sides; the dashboard card always draws the line. */
  view?: NetWorthView;
  /** Start the value axis at zero; off by default, as the chart has always been. */
  zeroBaseline?: boolean;
  formatValue: (value: number) => string;
  /** Labels for three value lines; left out on small charts, which go without a scale. */
  formatTick?: (value: number) => string;
  /** Names of the two sides and the net; only the breakdown view needs them. */
  labels?: { assets: string; liabilities: string; net: string };
}

export function NetWorthChart({
  points,
  positive,
  view = 'performance',
  zeroBaseline = false,
  formatValue,
  formatTick,
  labels,
}: NetWorthChartProps) {
  const { locale } = useLocale();

  return (
    <>
      <div className="seneca-chart__box">
        {view === 'breakdown' && labels ? (
          <LazyNetWorthBreakdown
            points={points}
            locale={locale}
            formatValue={formatValue}
            labels={labels}
          />
        ) : (
          <LazyNetWorthArea
            points={points}
            positive={positive}
            locale={locale}
            formatValue={formatValue}
            formatTick={formatTick}
            zeroBaseline={zeroBaseline}
          />
        )}
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
