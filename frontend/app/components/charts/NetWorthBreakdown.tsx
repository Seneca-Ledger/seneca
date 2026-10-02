'use client';

import type React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartTooltipCard } from './ChartParts';
import { computeYearTicks, formatDayLabel } from './chart-format';
import { CHART_MARGIN, CHART_TICK } from './chart-theme';

export interface NetWorthBreakdownPoint {
  /** YYYY-MM-DD */
  date: string;
  assets: number;
  liabilities: number;
}

export interface NetWorthBreakdownProps {
  points: NetWorthBreakdownPoint[];
  locale: string;
  formatValue: (value: number) => string;
  labels: { assets: string; liabilities: string; net: string };
}

/**
 * What the net line hides: the two sides of it, assets above the axis and
 * debt below. A net worth that holds steady while the debt grows looks exactly
 * like one that holds steady with no debt at all — until you see this.
 */
export function NetWorthBreakdown({
  points,
  locale,
  formatValue,
  labels,
}: NetWorthBreakdownProps): React.JSX.Element {
  const data = points.map(point => ({
    date: point.date,
    assets: point.assets,
    // Below the axis: debt is what is taken away.
    liabilities: -point.liabilities,
  }));
  const yearTicks = computeYearTicks(points.map(point => point.date));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={CHART_MARGIN} stackOffset="sign">
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <YAxis hide domain={['auto', 'auto']} />
        {yearTicks.length > 0 && (
          <XAxis
            dataKey="date"
            ticks={yearTicks}
            tickFormatter={(key: string) => key.slice(0, 4)}
            axisLine={false}
            tickLine={false}
            tick={CHART_TICK}
            interval="preserveStartEnd"
          />
        )}
        <ReferenceLine y={0} stroke="var(--border)" />
        <Tooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.3 }}
          content={({ active, payload }) => {
            const point = payload?.[0]?.payload as
              | { date: string; assets: number; liabilities: number }
              | undefined;
            if (!(active && point)) {
              return null;
            }
            const owed = -point.liabilities;
            return (
              <ChartTooltipCard
                title={formatDayLabel(point.date, locale)}
                rows={[
                  { label: labels.assets, value: formatValue(point.assets) },
                  { label: labels.liabilities, value: formatValue(owed) },
                  { label: labels.net, value: formatValue(point.assets - owed), tone: 'strong' },
                ]}
              />
            );
          }}
        />
        <Bar
          dataKey="assets"
          stackId="net"
          fill="var(--ff-dash-success)"
          isAnimationActive={false}
        />
        <Bar
          dataKey="liabilities"
          stackId="net"
          fill="var(--ff-dash-critical)"
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
