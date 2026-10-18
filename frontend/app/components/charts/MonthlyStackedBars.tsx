/*
 * Chart design adapted from Aurum by ZProger (https://github.com/ZProger/Aurum).
 * Reimplemented for Lumio; no Aurum source code was copied.
 */
'use client';

import type React from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { ChartTooltipCard } from './ChartParts';
import { formatMonthLabel, monthAtIndex } from './chart-format';
import { CHART_MARGIN, CHART_TICK, HOVER_CURSOR, INACTIVE_BAR_OPACITY } from './chart-theme';

export interface MonthlySeries {
  key: string;
  label: string;
  color: string;
  /** Series of one hue told apart by strength: 1 is full colour. */
  opacity?: number;
}

export interface MonthlyStackedBarsProps {
  /** One point per month (YYYY-MM), carrying a numeric field per series key. */
  points: ReadonlyArray<{ month: string }>;
  series: MonthlySeries[];
  activeMonth: string;
  locale: string;
  onSelectMonth: (month: string) => void;
}

function seriesValue(point: { month: string }, key: string): number {
  return Number((point as unknown as Record<string, unknown>)[key]) || 0;
}

/** Stacked bars, one per month of a year; the picked month is full strength, the rest dimmed. */
export function MonthlyStackedBars({
  points,
  series,
  activeMonth,
  locale,
  onSelectMonth,
}: MonthlyStackedBarsProps): React.JSX.Element {
  const monthName = new Intl.DateTimeFormat(locale, { month: 'short' });
  const tickLabel = (key: string): string =>
    monthName.format(new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={[...points]}
        margin={CHART_MARGIN}
        onClick={state => {
          const month = monthAtIndex(points, state?.activeIndex);
          if (month) {
            onSelectMonth(month);
          }
        }}
      >
        <XAxis
          dataKey="month"
          tickFormatter={tickLabel}
          axisLine={false}
          tickLine={false}
          tick={CHART_TICK}
          interval={0}
        />
        <Tooltip
          cursor={HOVER_CURSOR}
          content={({ active, payload }) => {
            const point = payload?.[0]?.payload as { month: string } | undefined;
            if (!(active && point)) {
              return null;
            }
            return (
              <ChartTooltipCard
                title={formatMonthLabel(point.month, locale)}
                rows={series
                  .filter(item => seriesValue(point, item.key) > 0)
                  .map(item => ({
                    label: item.label,
                    value: String(seriesValue(point, item.key)),
                  }))}
              />
            );
          }}
        />
        {series.map(item => (
          <Bar
            key={item.key}
            dataKey={item.key}
            name={item.label}
            stackId="history"
            fill={item.color}
            // A hairline in the card colour keeps stacked parts of one hue apart.
            stroke="var(--card)"
            strokeWidth={1}
            isAnimationActive={false}
            cursor="pointer"
          >
            {points.map(point => (
              <Cell
                key={point.month}
                fillOpacity={
                  (item.opacity ?? 1) * (point.month === activeMonth ? 1 : INACTIVE_BAR_OPACITY)
                }
              />
            ))}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
