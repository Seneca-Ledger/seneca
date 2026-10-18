/*
 * Chart design adapted from Aurum by ZProger (https://github.com/ZProger/Aurum).
 * Reimplemented for Lumio; no Aurum source code was copied.
 */
'use client';

import type React from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartTooltipCard, type ChartTooltipRow } from './ChartParts';
import { computeYearTicks, formatDayLabel } from './chart-format';
import { CHART_MARGIN, CHART_TICK } from './chart-theme';

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
  /**
   * Draws three faint value lines with these labels, so the shape has a scale.
   * Left out on small charts, where the line alone is enough.
   */
  formatTick?: (value: number) => string;
  /** Points worth naming on the line (the lowest balance, the biggest drop): a dot and a short label. */
  markers?: Array<{ date: string; label?: string }>;
  /** A dashed level across the chart, e.g. the lowest balance it reaches. */
  floor?: number;
  /** More tooltip lines for a day, e.g. what was paid on it. */
  describeDay?: (date: string) => ChartTooltipRow[];
}

const MARKER_LABEL = { fontSize: 11, fill: 'var(--muted-foreground)' } as const;

export function trendColor(positive: boolean): string {
  return positive ? 'var(--money-up)' : 'var(--money-down)';
}

export function NetWorthArea({
  points,
  positive,
  locale,
  formatValue,
  formatTick,
  markers = [],
  floor,
  describeDay,
}: NetWorthAreaProps): React.JSX.Element {
  const color = trendColor(positive);
  const yearTicks = computeYearTicks(points.map(point => point.date));
  const valueOn = new Map(points.map(point => [point.date, point.value]));
  // With a value scale the year boundaries become thin vertical lines; a year
  // label hanging alone under the axis read as a stray caption.
  const scaled = Boolean(formatTick);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={points} margin={CHART_MARGIN}>
        {formatTick && (
          <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
        )}
        <YAxis
          hide={!formatTick}
          domain={['auto', 'auto']}
          tickCount={3}
          tickFormatter={formatTick}
          axisLine={false}
          tickLine={false}
          tick={CHART_TICK}
          width={formatTick ? 64 : 0}
        />
        {scaled ? (
          <XAxis dataKey="date" hide />
        ) : (
          yearTicks.length > 0 && (
            <XAxis
              dataKey="date"
              ticks={yearTicks}
              tickFormatter={(key: string) => key.slice(0, 4)}
              axisLine={false}
              tickLine={false}
              tick={CHART_TICK}
              interval="preserveStartEnd"
            />
          )
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
                rows={[
                  { value: formatValue(point.value), tone: 'strong' },
                  ...(describeDay?.(point.date) ?? []),
                ]}
              />
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          // Flat and faint: a gradient gave the area a weight the figure above it should have.
          fill={color}
          fillOpacity={0.08}
          isAnimationActive={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        {scaled &&
          yearTicks.map(date => (
            <ReferenceLine
              key={date}
              x={date}
              stroke="var(--border)"
              label={{ value: date.slice(0, 4), position: 'insideTopLeft', ...MARKER_LABEL }}
            />
          ))}
        {floor !== undefined && (
          <ReferenceLine y={floor} stroke={color} strokeOpacity={0.5} strokeDasharray="4 4" />
        )}
        {markers.map(marker => {
          const value = valueOn.get(marker.date);
          return value === undefined ? null : (
            <ReferenceDot
              key={marker.date}
              x={marker.date}
              y={value}
              r={3.5}
              fill={color}
              stroke="var(--card-bg)"
              strokeWidth={1.5}
              label={
                marker.label
                  ? { value: marker.label, position: 'bottom', ...MARKER_LABEL }
                  : undefined
              }
            />
          );
        })}
      </AreaChart>
    </ResponsiveContainer>
  );
}
