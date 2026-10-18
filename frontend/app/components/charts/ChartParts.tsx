/*
 * Chart design adapted from Aurum by ZProger (https://github.com/ZProger/Aurum).
 * Reimplemented for Lumio; no Aurum source code was copied.
 */
import clsx from 'clsx';
import type React from 'react';

export interface ChartTooltipRow {
  /** Omitted for single-value charts, where the title already names the point. */
  label?: string;
  value: string;
  tone?: 'positive' | 'negative' | 'strong';
}

export function ChartTooltipCard({
  title,
  rows,
}: {
  title: string;
  rows: ChartTooltipRow[];
}): React.JSX.Element {
  return (
    <div className="lumio-chart__tooltip">
      <div className="lumio-chart__tooltip-title">{title}</div>
      {rows.map(row => (
        <div
          key={`${row.label ?? ''}:${row.value}`}
          className={clsx(
            'lumio-chart__tooltip-row',
            row.tone && `lumio-chart__tooltip-row--${row.tone}`,
          )}
        >
          {row.label ? `${row.label}: ${row.value}` : row.value}
        </div>
      ))}
    </div>
  );
}

/**
 * A legend entry's text in the readable grey. Recharts paints it in the series
 * colour by default, which turns the legend into two coloured words.
 */
export function legendText(value: string): React.JSX.Element {
  return <span style={{ color: 'var(--text-muted)' }}>{value}</span>;
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
    <div className="lumio-chart__footer">
      <span>{start}</span>
      <span>{end}</span>
    </div>
  );
}
