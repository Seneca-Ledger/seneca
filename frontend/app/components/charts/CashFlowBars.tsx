/*
 * Chart design adapted from Aurum by ZProger (https://github.com/ZProger/Aurum).
 * Reimplemented for Seneca; no Aurum source code was copied.
 */
'use client';

import type React from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DashboardCashFlowEntry, DashboardCashFlowPoint } from '@/app/hooks/useDashboard';
import { ChartTooltipCard, type ChartTooltipRow } from './ChartParts';
import { compressedAxis, formatDayLabel, formatShortDayLabel } from './chart-format';
import {
  BUDGETED_FILL,
  CHART_MARGIN,
  CHART_TICK,
  EXPENSE_FILL,
  GRID_STROKE,
  HOVER_CURSOR,
  INCOME_FILL,
} from './chart-theme';

export interface CashFlowBarsProps {
  /** One point a day (`date` is YYYY-MM-DD). */
  points: DashboardCashFlowPoint[];
  locale: string;
  labels: { income: string; expense: string; budgeted: string; noData: string };
  formatAmount: (value: number) => string;
  /** Amounts on the Y axis, in full ("$1,000"). */
  formatTick: (value: number) => string;
  /** The top of the scale: the month's income rounded up (or its biggest bar, if larger). */
  ceiling: number;
  /** The month's typical spend: where the scale's lines start and its compression bends. */
  typical: number;
  /**
   * Wide bars that scroll sideways (a phone): every day keeps its date and the Y axis,
   * which would scroll away with them, is left out; a tap on a bar gives the amounts.
   */
  everyDay?: boolean;
  /** What each day's bars are made of, by YYYY-MM-DD; `undefined` while it loads. */
  entriesByDay?: ReadonlyMap<string, DashboardCashFlowEntry[]>;
}

/** A tooltip names this many rows of a day; more are summed up as "…". */
const TOOLTIP_ENTRIES = 5;

/**
 * A day's rows by name, biggest first: the bar colours already say income or expense, so the
 * tooltip says what it was. A spend carries the colour of its part of the bar: blue for what a
 * budget had room for, terracotta for the rest, and one partly over its budget is named twice.
 */
export function entryRows(
  entries: DashboardCashFlowEntry[] | undefined,
  formatAmount: (value: number) => string,
): ChartTooltipRow[] {
  if (!entries) {
    return [{ value: '…' }];
  }
  const rows = entries.slice(0, TOOLTIP_ENTRIES).flatMap((entry): ChartTooltipRow[] => {
    if (entry.kind === 'income') {
      return [{ label: entry.name, value: formatAmount(entry.amount), tone: 'positive' }];
    }
    const budgeted = Math.min(entry.budgeted, entry.amount);
    const rest = entry.amount - budgeted;
    const parts: ChartTooltipRow[] = [];
    if (budgeted > 0) {
      parts.push({ label: entry.name, value: formatAmount(budgeted), tone: 'budgeted' });
    }
    if (rest > 0 || parts.length === 0) {
      parts.push({ label: entry.name, value: formatAmount(rest), tone: 'negative' });
    }
    return parts;
  });
  return entries.length > TOOLTIP_ENTRIES ? [...rows, { value: '…' }] : rows;
}

/**
 * A day's spending bar as two stacked parts in scale units: the budgeted part at the bottom and
 * the rest (over a limit, or without a budget) on top. The scale is compressed, so the top part
 * is what is left up to the whole bar's height rather than the unbudgeted amount on its own.
 */
export function expenseStack(
  point: DashboardCashFlowPoint,
  toY: (amount: number) => number,
): { budgeted: number; rest: number } {
  const budgeted = toY(Math.min(point.budgeted, point.expense));
  return { budgeted, rest: toY(point.expense) - budgeted };
}

/** Grouped daily income/expense bars with a scale and dates; fills its parent box. */
export function CashFlowBars({
  points,
  locale,
  labels,
  formatAmount,
  formatTick,
  everyDay = false,
  entriesByDay,
  ceiling,
  typical,
}: CashFlowBarsProps): React.JSX.Element {
  // Bars and lines are drawn at toY(amount); the labels and the tooltip keep the amounts.
  const { ticks, toY } = compressedAxis(ceiling, typical);
  const tickAmount = new Map(ticks.map(tick => [toY(tick), tick]));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={points} margin={CHART_MARGIN}>
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <YAxis
          domain={[0, toY(ceiling)]}
          ticks={ticks.map(toY)}
          interval={0}
          tickFormatter={(y: number) => formatTick(tickAmount.get(y) ?? 0)}
          axisLine={false}
          tickLine={false}
          tick={CHART_TICK}
          width={64}
          hide={everyDay}
        />
        <XAxis
          dataKey="date"
          tickFormatter={(key: string) => formatShortDayLabel(key, locale)}
          axisLine={false}
          tickLine={false}
          tick={CHART_TICK}
          interval={everyDay ? 0 : 'preserveStartEnd'}
          minTickGap={16}
        />
        <Tooltip
          cursor={HOVER_CURSOR}
          content={({ active, payload }) => {
            const point = payload?.[0]?.payload as DashboardCashFlowPoint | undefined;
            if (!(active && point)) {
              return null;
            }
            const title = formatDayLabel(point.date, locale);
            // A day with nothing in it says so, rather than "Income: $0, Expense: $0, Net: +$0".
            if (point.income === 0 && point.expense === 0) {
              return <ChartTooltipCard title={title} rows={[{ value: labels.noData }]} />;
            }
            const rows = entryRows(
              entriesByDay ? (entriesByDay.get(point.date) ?? []) : undefined,
              formatAmount,
            );
            return <ChartTooltipCard title={title} rows={rows} />;
          }}
        />
        <Bar
          dataKey={(point: DashboardCashFlowPoint) => toY(point.income)}
          name={labels.income}
          fill={INCOME_FILL}
          radius={[2, 2, 0, 0]}
          isAnimationActive={false}
        />
        <Bar
          dataKey={(point: DashboardCashFlowPoint) => expenseStack(point, toY).budgeted}
          name={labels.budgeted}
          stackId="expense"
          fill={BUDGETED_FILL}
          isAnimationActive={false}
        />
        <Bar
          dataKey={(point: DashboardCashFlowPoint) => expenseStack(point, toY).rest}
          name={labels.expense}
          stackId="expense"
          fill={EXPENSE_FILL}
          radius={[2, 2, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
