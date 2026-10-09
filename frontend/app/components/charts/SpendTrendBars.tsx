'use client';

import type React from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts';
import { ChartTooltipCard } from './ChartParts';
import { formatDayLabel, formatShortDayLabel } from './chart-format';
import { CHART_MARGIN, CHART_TICK, INACTIVE_BAR_OPACITY, LEGEND_STYLE } from './chart-theme';

export interface SpendTrendPoint {
  /** YYYY-MM-DD */
  date: string;
  income: number;
  expense: number;
}

export interface SpendTrendBarsProps {
  actual: SpendTrendPoint[];
  /** Continuation past `actual`, rendered as dimmed bars. */
  forecast: SpendTrendPoint[];
  locale: string;
  labels: { income: string; expense: string; forecastSuffix: string; forecastLabel: string };
  formatAmount: (value: number) => string;
}

interface ChartPoint extends SpendTrendPoint {
  isForecast: boolean;
}

/** Daily income/expense bars; fills its parent box. Forecast days are dimmed. */
export function SpendTrendBars({
  actual,
  forecast,
  locale,
  labels,
  formatAmount,
}: SpendTrendBarsProps): React.JSX.Element {
  const points: ChartPoint[] = [
    ...actual.map(point => ({ ...point, isForecast: false })),
    ...forecast.map(point => ({ ...point, isForecast: true })),
  ];
  const lastActualDate = actual[actual.length - 1]?.date;
  // Same Cell array handed to both Bars, as CashFlowBars does — React allows an
  // element to render in more than one place as long as siblings keep unique keys.
  const cells = points.map(point => (
    <Cell key={point.date} fillOpacity={point.isForecast ? INACTIVE_BAR_OPACITY : 1} />
  ));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={points} margin={CHART_MARGIN}>
        <XAxis
          dataKey="date"
          tickFormatter={(key: string) => formatShortDayLabel(key, locale)}
          axisLine={false}
          tickLine={false}
          tick={CHART_TICK}
          interval="preserveStartEnd"
        />
        {forecast.length > 0 && lastActualDate && (
          <ReferenceLine
            x={lastActualDate}
            stroke="var(--muted-foreground)"
            strokeDasharray="3 3"
            label={{
              value: labels.forecastLabel,
              position: 'insideTopRight',
              fill: 'var(--muted-foreground)',
              fontSize: 10,
            }}
          />
        )}
        <Tooltip
          cursor={{ fill: 'var(--muted)' }}
          content={({ active, payload }) => {
            const point = payload?.[0]?.payload as ChartPoint | undefined;
            if (!(active && point)) {
              return null;
            }
            const title = `${formatDayLabel(point.date, locale)}${point.isForecast ? labels.forecastSuffix : ''}`;
            return (
              <ChartTooltipCard
                title={title}
                rows={[
                  { label: labels.income, value: formatAmount(point.income), tone: 'positive' },
                  { label: labels.expense, value: formatAmount(point.expense), tone: 'negative' },
                ]}
              />
            );
          }}
        />
        <Legend
          verticalAlign="top"
          height={24}
          iconType="square"
          iconSize={10}
          wrapperStyle={LEGEND_STYLE}
        />
        <Bar
          dataKey="income"
          name={labels.income}
          fill="var(--ff-dash-success)"
          radius={[2, 2, 0, 0]}
          isAnimationActive={false}
        >
          {cells}
        </Bar>
        <Bar
          dataKey="expense"
          name={labels.expense}
          fill="var(--ff-dash-critical)"
          radius={[2, 2, 0, 0]}
          isAnimationActive={false}
        >
          {cells}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
