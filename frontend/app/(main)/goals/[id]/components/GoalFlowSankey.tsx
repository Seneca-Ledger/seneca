'use client';

import { useTheme } from 'next-themes';
import type React from 'react';
import { useMemo } from 'react';
import { DashboardCard } from '@/app/components/dashboard/ui';
import { LazyECharts } from '@/app/components/ui/lazy-echarts';
import type { GoalFlowResponse } from '@/app/lib/goals-api';
import { useCategoryName } from '@/app/lib/use-category-name';
import { buildGoalFlowSankey, type GoalFlowChartLabels } from './goal-flow.chart';

export interface GoalFlowSankeyProps {
  data: GoalFlowResponse;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  emptyLabel: string;
  labels: GoalFlowChartLabels;
  formatAmount: (value: number) => string;
}

export function GoalFlowSankey({
  data,
  title,
  subtitle,
  action,
  emptyLabel,
  labels,
  formatAmount,
}: GoalFlowSankeyProps): React.JSX.Element {
  const { resolvedTheme } = useTheme();
  const categoryName = useCategoryName();

  const option = useMemo(
    () => buildGoalFlowSankey(data, resolvedTheme, labels, formatAmount, categoryName),
    [data, resolvedTheme, labels, formatAmount, categoryName],
  );

  // A goal with no budgets attached has no tree to draw, and a sankey of one
  // node reads as a rendering bug rather than as an empty state.
  const hasFlow = data.links.length > 0;

  return (
    <DashboardCard title={title} subtitle={subtitle} action={action}>
      {hasFlow ? (
        // A definite height, not one inherited from flex: ECharts measures the
        // container once on mount and caches a 0x0 box forever if the height is
        // still being resolved at that moment. Four ranks of labels need the room.
        <LazyECharts option={option} style={{ height: 440, width: '100%' }} notMerge />
      ) : (
        <p className="lumio-dashboard__empty">{emptyLabel}</p>
      )}
    </DashboardCard>
  );
}
