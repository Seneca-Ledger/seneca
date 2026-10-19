'use client';

import Skeleton from '@mui/material/Skeleton';
import dynamic from 'next/dynamic';

/**
 * Recharts ships as its own chunk, loaded only where a chart renders. The skeleton fills the same
 * box the chart will, so the card height does not jump when the chunk arrives.
 */
function ChartSkeleton(): React.JSX.Element {
  return <Skeleton variant="rounded" width="100%" height="100%" />;
}

export const LazyCashFlowBars = dynamic(
  () => import('./CashFlowBars').then(module => module.CashFlowBars),
  { ssr: false, loading: ChartSkeleton },
);

export const LazyNetWorthArea = dynamic(
  () => import('./NetWorthArea').then(module => module.NetWorthArea),
  { ssr: false, loading: ChartSkeleton },
);

export const LazyCategoryDonut = dynamic(
  () => import('./CategoryDonut').then(module => module.CategoryDonut),
  { ssr: false, loading: ChartSkeleton },
);

export const LazyMonthlyStackedBars = dynamic(
  () => import('./MonthlyStackedBars').then(module => module.MonthlyStackedBars),
  { ssr: false, loading: ChartSkeleton },
);

export const LazyRoiLines = dynamic(() => import('./RoiLines').then(module => module.RoiLines), {
  ssr: false,
  loading: ChartSkeleton,
});

export const LazySpendTrendBars = dynamic(
  () => import('./SpendTrendBars').then(module => module.SpendTrendBars),
  { ssr: false, loading: ChartSkeleton },
);
