/*
 * Chart design adapted from Aurum by ZProger (https://github.com/ZProger/Aurum).
 * Reimplemented for Seneca; no Aurum source code was copied.
 */
'use client';

import type React from 'react';
import { Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltipCard } from './ChartParts';
import { CHART_MARGIN, CHART_TICK, LEGEND_STYLE } from './chart-theme';

const TICK_EVERY_YEARS = 5;

export interface RoiLinePoint {
  year: number;
  compound: number;
  simple: number;
}

export interface RoiLinesProps {
  points: RoiLinePoint[];
  labels: { compound: string; simple: string; year: string };
  formatValue: (value: number) => string;
}

export function roiYearTicks(points: readonly RoiLinePoint[]): number[] {
  return points.filter(point => point.year % TICK_EVERY_YEARS === 0).map(point => point.year);
}

/** Compound (solid) against simple (dashed) growth over the projection horizon. */
export function RoiLines({ points, labels, formatValue }: RoiLinesProps): React.JSX.Element {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points} margin={CHART_MARGIN}>
        <XAxis
          dataKey="year"
          type="number"
          domain={['dataMin', 'dataMax']}
          ticks={roiYearTicks(points)}
          axisLine={false}
          tickLine={false}
          tick={CHART_TICK}
        />
        {/* Log scale: reinvested vs. cash-aside can differ by orders of magnitude. */}
        <YAxis hide scale="log" domain={['auto', 'auto']} allowDataOverflow />
        <Tooltip
          cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
          content={({ active, payload }) => {
            const point = payload?.[0]?.payload as RoiLinePoint | undefined;
            if (!(active && point)) {
              return null;
            }
            return (
              <ChartTooltipCard
                title={`${labels.year} ${point.year}`}
                rows={[
                  { label: labels.compound, value: formatValue(point.compound), tone: 'strong' },
                  { label: labels.simple, value: formatValue(point.simple) },
                ]}
              />
            );
          }}
        />
        <Legend verticalAlign="top" height={24} wrapperStyle={LEGEND_STYLE} />
        <Line
          type="monotone"
          dataKey="compound"
          name={labels.compound}
          stroke="var(--ff-dash-info)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="simple"
          name={labels.simple}
          stroke="var(--muted-foreground)"
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
