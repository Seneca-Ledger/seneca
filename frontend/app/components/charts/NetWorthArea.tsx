/*
 * Chart design adapted from Aurum by ZProger (https://github.com/ZProger/Aurum).
 * Reimplemented for Lumio; no Aurum source code was copied.
 */
'use client';

import type React from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltipCard } from './ChartParts';
import { compactNumber, computeYearTicks, formatDayLabel } from './chart-format';
import { CHART_MARGIN, CHART_TICK } from './chart-theme';

/** One net-worth chart per page, so a fixed gradient id cannot collide. */
const GRADIENT_ID = 'lumio-net-worth-fill';

export interface NetWorthAreaPoint {
  /** YYYY-MM-DD */
  date: string;
  value: number;
}

export interface NetWorthAreaProps {
  points: NetWorthAreaPoint[];
  /** Growth reads as success, decline as danger. */
  positive: boolean;
  locale: string;
  formatValue: (value: number) => string;
  /** Start the value axis at zero, which is what puts a move in proportion. */
  zeroBaseline?: boolean;
}

export function trendColor(positive: boolean): string {
  return positive ? 'var(--ff-dash-success)' : 'var(--ff-dash-critical)';
}

export function NetWorthArea({
  points,
  positive,
  locale,
  formatValue,
  zeroBaseline = false,
}: NetWorthAreaProps): React.JSX.Element {
  const color = trendColor(positive);
  const yearTicks = computeYearTicks(points.map(point => point.date));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={points} margin={CHART_MARGIN}>
        <defs>
          <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.18} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis
          domain={zeroBaseline ? [0, 'auto'] : ['auto', 'auto']}
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
            const point = payload?.[0]?.payload as NetWorthAreaPoint | undefined;
            if (!(active && point)) {
              return null;
            }
            return (
              <ChartTooltipCard
                title={formatDayLabel(point.date, locale)}
                rows={[{ value: formatValue(point.value), tone: 'strong' }]}
              />
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${GRADIENT_ID})`}
          isAnimationActive={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
