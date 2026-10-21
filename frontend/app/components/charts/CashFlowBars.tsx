/*
 * Chart design adapted from Aurum by ZProger (https://github.com/ZProger/Aurum).
 * Reimplemented for Seneca; no Aurum source code was copied.
 */
'use client';

import type React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartTooltipCard } from './ChartParts';
import {
  computeYearTicks,
  formatMonthLabel,
  formatShortMonthLabel,
  formatSignedAmount,
  monthAtIndex,
} from './chart-format';
import {
  CHART_MARGIN,
  CHART_TICK,
  EXPENSE_FILL,
  GRID_STROKE,
  HOVER_CURSOR,
  INACTIVE_BAR_OPACITY,
  INCOME_FILL,
} from './chart-theme';

export interface CashFlowBarPoint {
  /** YYYY-MM */
  month: string;
  income: number;
  expense: number;
  net: number;
}

export interface CashFlowBarsProps {
  points: CashFlowBarPoint[];
  locale: string;
  labels: { income: string; expense: string; net: string; noData: string };
  formatAmount: (value: number) => string;
  /** Short amounts for the Y axis ("$1.2K"). */
  formatTick: (value: number) => string;
  /** Picked month (YYYY-MM); when it is on the chart, the other months are dimmed. */
  activeMonth?: string;
  onSelectMonth?: (month: string) => void;
}

/** Grouped monthly income/expense bars with a scale and month names; fills its parent box. */
export function CashFlowBars({
  points,
  locale,
  labels,
  formatAmount,
  formatTick,
  activeMonth,
  onSelectMonth,
}: CashFlowBarsProps): React.JSX.Element {
  const yearTicks = computeYearTicks(points.map(point => point.month));
  const dimOthers = points.some(point => point.month === activeMonth);
  const cells = points.map(point => (
    <Cell
      key={point.month}
      fillOpacity={!dimOthers || point.month === activeMonth ? 1 : INACTIVE_BAR_OPACITY}
    />
  ));
  const cursor = onSelectMonth ? 'pointer' : undefined;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={points}
        margin={CHART_MARGIN}
        onClick={state => {
          const month = monthAtIndex(points, state?.activeIndex);
          if (month) {
            onSelectMonth?.(month);
          }
        }}
      >
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <YAxis
          tickCount={3}
          tickFormatter={formatTick}
          axisLine={false}
          tickLine={false}
          tick={CHART_TICK}
          width={56}
        />
        <XAxis
          dataKey="month"
          tickFormatter={(key: string) => formatShortMonthLabel(key, locale)}
          axisLine={false}
          tickLine={false}
          tick={CHART_TICK}
          interval="preserveStartEnd"
          minTickGap={8}
        />
        {/* A new year starts at a thin line before its January, named at the top. */}
        {yearTicks.map(month => (
          <ReferenceLine
            key={month}
            x={month}
            position="start"
            stroke={GRID_STROKE}
            label={{
              value: month.slice(0, 4),
              position: 'insideTopLeft',
              fill: 'var(--text-muted)',
              fontSize: 12,
            }}
          />
        ))}
        <Tooltip
          cursor={HOVER_CURSOR}
          content={({ active, payload }) => {
            const point = payload?.[0]?.payload as CashFlowBarPoint | undefined;
            if (!(active && point)) {
              return null;
            }
            const title = formatMonthLabel(point.month, locale);
            // A month with nothing in it says so, rather than "Income: $0, Expense: $0, Net: +$0".
            if (point.income === 0 && point.expense === 0) {
              return <ChartTooltipCard title={title} rows={[{ value: labels.noData }]} />;
            }
            return (
              <ChartTooltipCard
                title={title}
                rows={[
                  { label: labels.income, value: formatAmount(point.income), tone: 'positive' },
                  { label: labels.expense, value: formatAmount(point.expense), tone: 'negative' },
                  {
                    label: labels.net,
                    value: formatSignedAmount(point.net, formatAmount),
                    tone: 'strong',
                  },
                ]}
              />
            );
          }}
        />
        <Bar
          dataKey="income"
          name={labels.income}
          fill={INCOME_FILL}
          radius={[2, 2, 0, 0]}
          isAnimationActive={false}
          cursor={cursor}
        >
          {cells}
        </Bar>
        <Bar
          dataKey="expense"
          name={labels.expense}
          fill={EXPENSE_FILL}
          radius={[2, 2, 0, 0]}
          isAnimationActive={false}
          cursor={cursor}
        >
          {cells}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
