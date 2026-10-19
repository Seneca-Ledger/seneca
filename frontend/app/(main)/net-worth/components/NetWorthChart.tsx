'use client';

import { ChartRangeFooter } from '@/app/components/charts/ChartParts';
import { formatDayLabel } from '@/app/components/charts/chart-format';
import { LazyNetWorthArea } from '@/app/components/charts/lazy-charts';
import { useLocale } from '@/app/i18n';
import type { NetWorthPoint } from '../hooks/useNetWorth';

interface NetWorthChartProps {
  points: NetWorthPoint[];
  /** Colours the line: growth reads as success, decline as danger. */
  positive: boolean;
  formatValue: (value: number) => string;
  /** Labels for three value lines; left out on small charts, which go without a scale. */
  formatTick?: (value: number) => string;
}

export function NetWorthChart({ points, positive, formatValue, formatTick }: NetWorthChartProps) {
  const { locale } = useLocale();

  return (
    <>
      <div className="seneca-chart__box">
        <LazyNetWorthArea
          points={points}
          positive={positive}
          locale={locale}
          formatValue={formatValue}
          formatTick={formatTick}
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
