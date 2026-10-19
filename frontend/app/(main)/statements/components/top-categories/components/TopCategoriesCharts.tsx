'use client';

import dynamic from 'next/dynamic';
import { AnalyticsChartCard } from '@/app/(main)/statements/components/analytics/AnalyticsChartCard';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

type Props = {
  trendChart: object;
  sourceChart: object;
  topCategoriesChart: object;
  chartTheme: string;
  trendTitle: string;
  sourceSplitTitle: string;
  categoriesTitle: string;
};

export function TopCategoriesCharts({
  trendChart,
  sourceChart,
  topCategoriesChart,
  chartTheme,
  trendTitle,
  sourceSplitTitle,
  categoriesTitle,
}: Props): React.JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
        <AnalyticsChartCard title={trendTitle} spanColumns={2}>
          <ReactECharts
            style={{ height: 300 }}
            option={trendChart}
            notMerge
            lazyUpdate
            theme={chartTheme}
          />
        </AnalyticsChartCard>
        <AnalyticsChartCard title={sourceSplitTitle}>
          <ReactECharts
            style={{ height: 300 }}
            option={sourceChart}
            notMerge
            lazyUpdate
            theme={chartTheme}
          />
        </AnalyticsChartCard>
      </div>
      <AnalyticsChartCard title={categoriesTitle}>
        <ReactECharts
          style={{ height: 320 }}
          option={topCategoriesChart}
          notMerge
          lazyUpdate
          theme={chartTheme}
        />
      </AnalyticsChartCard>
    </div>
  );
}
