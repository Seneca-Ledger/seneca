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
  view: NetWorthView;
  formatValue: (value: number) => string;
  labels: { assets: string; liabilities: string; net: string };
}

export function NetWorthChart({ points, positive, view, formatValue, labels }: NetWorthChartProps) {
  const { locale } = useLocale();

  return (
    <>
      <div className="lumio-chart__box">
        {view === 'breakdown' ? (
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
