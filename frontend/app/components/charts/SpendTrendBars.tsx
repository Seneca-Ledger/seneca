'use client';

import type React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartTooltipCard, legendText } from './ChartParts';
import { formatDayLabel, formatShortDayLabel } from './chart-format';
import {
  CHART_MARGIN,
  CHART_TICK,
  EXPENSE_FILL,
  FORECAST_OPACITY,
  GRID_STROKE,
  HOVER_CURSOR,
  INCOME_FILL,
  LEGEND_STYLE,
} from './chart-theme';

export interface SpendTrendPoint {
  /** YYYY-MM-DD */
  date: string;
  income: number;
  expense: number;
}

export interface SpendTrendBarsProps {
  actual: SpendTrendPoint[];
  /** Continuation past `actual`, rendered as faint bars. */
  forecast: SpendTrendPoint[];
  locale: string;
  labels: { income: string; expense: string; forecastSuffix: string; forecastLabel: string };
  formatAmount: (value: number) => string;
  /** Short amounts for the Y axis ("$1.2K"). */
  formatTick: (value: number) => string;
}

interface ChartPoint extends SpendTrendPoint {
  isForecast: boolean;
}

/** Daily income/expense bars; fills its parent box. Forecast days are faint. */
export function SpendTrendBars({
  actual,
  forecast,
  locale,
  labels,
  formatAmount,
  formatTick,
}: SpendTrendBarsProps): React.JSX.Element {
  const points: ChartPoint[] = [
    ...actual.map(point => ({ ...point, isForecast: false })),
    ...forecast.map(point => ({ ...point, isForecast: true })),
  ];
  const firstForecastDate = forecast[0]?.date;
  // Same Cell array handed to both Bars, as CashFlowBars does — React allows an
  // element to render in more than one place as long as siblings keep unique keys.
  const cells = points.map(point => (
    <Cell key={point.date} fillOpacity={point.isForecast ? FORECAST_OPACITY : 1} />
  ));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={points} margin={CHART_MARGIN}>
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <YAxis
          tickCount={3}
          tickFormatter={formatTick}
          axisLine={false}
          tickLine={false}
          tick={CHART_TICK}
          width={56}
        />
        {/* Every third day: thirty dates side by side are unreadable. */}
        <XAxis
          dataKey="date"
          tickFormatter={(key: string) => formatShortDayLabel(key, locale)}
          axisLine={false}
          tickLine={false}
          tick={CHART_TICK}
          interval={2}
        />
        {/* The line stands before the first forecast day, its name to the right over the guesses. */}
        {firstForecastDate && (
          <ReferenceLine
            x={firstForecastDate}
            position="start"
            stroke="var(--text-muted)"
            strokeDasharray="3 3"
            label={{
              value: labels.forecastLabel,
              position: 'insideTopLeft',
              fill: 'var(--text-muted)',
              fontSize: 12,
            }}
          />
        )}
        <Tooltip
          cursor={HOVER_CURSOR}
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
          height={28}
          iconType="square"
          iconSize={10}
          wrapperStyle={LEGEND_STYLE}
          formatter={legendText}
        />
        <Bar
          dataKey="income"
          name={labels.income}
          fill={INCOME_FILL}
          radius={[2, 2, 0, 0]}
          isAnimationActive={false}
        >
          {cells}
        </Bar>
        <Bar
          dataKey="expense"
          name={labels.expense}
          fill={EXPENSE_FILL}
          radius={[2, 2, 0, 0]}
          isAnimationActive={false}
        >
          {cells}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
