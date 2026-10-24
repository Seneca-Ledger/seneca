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
import { CHART_MARGIN, CHART_TICK, LEGEND_STYLE, merchantTones } from './chart-theme';

export interface PayeeLine {
  payeeId: string;
  name: string;
  values: readonly number[];
  isSelf: boolean;
}

export interface PayeeLinesProps {
  /** `YYYY-MM`, oldest first; each line has one value per month. */
  months: readonly string[];
  lines: readonly PayeeLine[];
  locale: string;
  formatValue: (value: number) => string;
  /** Short amounts for the scale ("€1.2K"). */
  formatTick: (value: number) => string;
}

/**
 * One payee month by month against others of its category: smooth lines, each
 * merchant in its own tone (the same as on its bars), the payee itself the
 * bold one.
 */
export function PayeeLines({
  months,
  lines,
  locale,
  formatValue,
  formatTick,
}: PayeeLinesProps): React.JSX.Element {
  const monthName = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' });
  const monthTitle = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const tones = merchantTones(lines.map(line => line.name));
  const data = months.map((month, index) => ({
    month,
    ...Object.fromEntries(lines.map(line => [line.payeeId, line.values[index] ?? 0])),
  }));
  const dateOf = (month: string) => new Date(`${month}-01T00:00:00Z`);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="month"
          axisLine={false}
          tickLine={false}
          tick={CHART_TICK}
          tickFormatter={month => monthName.format(dateOf(String(month)))}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={CHART_TICK}
          tickFormatter={value => formatTick(Number(value))}
          width={56}
        />
        <Tooltip
          cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
          content={({ active, label }) => {
            const index = months.indexOf(String(label));
            if (!active || index < 0) {
              return null;
            }
            return (
              <ChartTooltipCard
                title={monthTitle.format(dateOf(months[index]))}
                rows={lines.map(line => ({
                  label: line.name,
                  value: formatValue(line.values[index] ?? 0),
                  tone: line.isSelf ? 'strong' : undefined,
                }))}
              />
            );
          }}
        />
        <Legend verticalAlign="top" height={28} wrapperStyle={LEGEND_STYLE} />
        {lines.map((line, index) => (
          <Line
            key={line.payeeId}
            type="monotone"
            dataKey={line.payeeId}
            name={line.name}
            stroke={tones[index]}
            strokeWidth={line.isSelf ? 2.5 : 1.5}
            strokeOpacity={line.isSelf ? 1 : 0.8}
            dot={false}
            activeDot={{ r: line.isSelf ? 4 : 3 }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
