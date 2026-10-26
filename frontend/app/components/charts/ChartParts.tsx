/*
 * Chart design adapted from Aurum by ZProger (https://github.com/ZProger/Aurum).
 * Reimplemented for Seneca; no Aurum source code was copied.
 */
import clsx from 'clsx';
import type React from 'react';

export interface ChartTooltipRow {
  /** Omitted for single-value charts, where the title already names the point. */
  label?: string;
  value: string;
  tone?: 'positive' | 'negative' | 'budgeted' | 'strong';
}

export function ChartTooltipCard({
  title,
  rows,
}: {
  title: string;
  rows: ChartTooltipRow[];
}): React.JSX.Element {
  return (
    <div className="seneca-chart__tooltip">
      <div className="seneca-chart__tooltip-title">{title}</div>
      {rows.map((row, index) => (
        <div
          // Two rows can read the same (two coffees at one price on one day).
          // biome-ignore lint/suspicious/noArrayIndexKey: the rows are a fixed list per render
          key={index}
          className={clsx(
            'seneca-chart__tooltip-row',
            row.tone && `seneca-chart__tooltip-row--${row.tone}`,
          )}
        >
          {row.label ? `${row.label}: ${row.value}` : row.value}
        </div>
      ))}
    </div>
  );
}

/** First and last point labels under a chart that has no permanent X axis. */
export function ChartRangeFooter({
  start,
  end,
}: {
  start: string;
  end: string;
}): React.JSX.Element {
  return (
    <div className="seneca-chart__footer">
      <span>{start}</span>
      <span>{end}</span>
    </div>
  );
}
