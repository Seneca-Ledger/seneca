/*
 * Chart design adapted from Aurum by ZProger (https://github.com/ZProger/Aurum).
 * Reimplemented for Seneca; no Aurum source code was copied.
 */
'use client';

import type React from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
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

/** Up to three powers of ten that span the data: the scale is logarithmic, so a zero line cannot exist. */
export function roiValueTicks(points: readonly RoiLinePoint[]): number[] {
  const values = points.flatMap(point => [point.compound, point.simple]).filter(value => value > 0);
  if (values.length === 0) {
    return [];
  }
  const low = Math.floor(Math.log10(Math.min(...values)));
  const high = Math.ceil(Math.log10(Math.max(...values)));
  const decades = Array.from({ length: high - low + 1 }, (_, index) => 10 ** (low + index));
  if (decades.length <= 3) {
    return decades;
  }
  return [decades[0], decades[Math.floor(decades.length / 2)], decades[decades.length - 1]];
}

/** Compound (solid) against simple (dashed) growth over the projection horizon. */
export function RoiLines({ points, labels, formatValue }: RoiLinesProps): React.JSX.Element {
  const valueTicks = roiValueTicks(points);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points} margin={CHART_MARGIN}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
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
        <YAxis
          scale="log"
          ticks={valueTicks}
          domain={
            valueTicks.length > 0
              ? [valueTicks[0], valueTicks[valueTicks.length - 1]]
              : ['auto', 'auto']
          }
          allowDataOverflow
          axisLine={false}
          tickLine={false}
          tick={CHART_TICK}
          tickFormatter={formatValue}
          width={56}
        />
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
          stroke="var(--primary)"
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
