'use client';

import type React from 'react';
import {
  Area,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartTooltipCard } from './ChartParts';
import { compactNumber, computeYearTicks, formatDayLabel } from './chart-format';
import { CHART_MARGIN, CHART_TICK, LEGEND_STYLE } from './chart-theme';
import { trendColor } from './NetWorthArea';

/** One returns chart per page, so a fixed gradient id cannot collide. */
const GRADIENT_ID = 'seneca-returns-fill';

export interface ReturnsAreaPoint {
  /** YYYY-MM-DD */
  date: string;
  value: number;
  netContributed: number;
}

export interface ReturnsAreaProps {
  points: ReturnsAreaPoint[];
  /** Growth reads as success, decline as danger. */
  positive: boolean;
  locale: string;
  formatValue: (value: number) => string;
  labels: { value: string; netContributed: string; gain: string };
}

/**
 * What the investments are worth against what was put into them. The gap
 * between the two lines is the gain, so a line that only climbs because money
 * kept going in reads as exactly that.
 */
export function ReturnsArea({
  points,
  positive,
  locale,
  formatValue,
  labels,
}: ReturnsAreaProps): React.JSX.Element {
  const color = trendColor(positive);
  const yearTicks = computeYearTicks(points.map(point => point.date));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={points} margin={CHART_MARGIN}>
        <defs>
          <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.18} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis
          domain={['auto', 'auto']}
          axisLine={false}
          tickLine={false}
          tick={CHART_TICK}
          width={56}
          tickFormatter={(value: number) => compactNumber(value, locale)}
        />
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
        <Tooltip
          cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
          content={({ active, payload }) => {
            const point = payload?.[0]?.payload as ReturnsAreaPoint | undefined;
            if (!(active && point)) {
              return null;
            }
            return (
              <ChartTooltipCard
                title={formatDayLabel(point.date, locale)}
                rows={[
                  { label: labels.value, value: formatValue(point.value), tone: 'strong' },
                  { label: labels.netContributed, value: formatValue(point.netContributed) },
                  {
                    label: labels.gain,
                    value: formatValue(point.value - point.netContributed),
                  },
                ]}
              />
            );
          }}
        />
        <Legend iconType="plainline" wrapperStyle={LEGEND_STYLE} />
        <Area
          type="monotone"
          dataKey="value"
          name={labels.value}
          stroke={color}
          strokeWidth={2}
          fill={`url(#${GRADIENT_ID})`}
          isAnimationActive={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        <Line
          type="stepAfter"
          dataKey="netContributed"
          name={labels.netContributed}
          stroke="var(--muted-foreground)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
