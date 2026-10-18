import clsx from 'clsx';
import Link from 'next/link';
import type React from 'react';
import { GRID_COLUMNS } from '../overview-layout';
import { useSectionSpan } from '../section-span';
import { Sparkline } from './Sparkline';

export type KpiTone = 'neutral' | 'positive' | 'negative' | 'warning' | 'info';

export interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  tone?: KpiTone;
  caption?: React.ReactNode;
  /** Sparkline points; the line takes the card's tone colour, as does a dot by the label. */
  spark?: { points: number[] };
  /** Renders the whole card as a link. */
  href?: string;
  /** Marks the card as the target of a `?focus=` deep link. */
  attentionId?: string;
  /** With half a row or more: a longer sparkline in place of `spark`. */
  wideSpark?: { points: number[] };
  /** With half a row or more: label–value lines under the figure. */
  details?: Array<{ label: string; value: React.ReactNode }>;
  /** With half a row or more: a full chart in place of the sparkline. */
  wideChart?: React.ReactNode;
}

export function KpiCard({
  label,
  value,
  tone = 'neutral',
  caption,
  spark,
  href,
  attentionId,
  wideSpark,
  details,
  wideChart,
}: KpiCardProps): React.JSX.Element {
  // A tile given half a row or more has room to say more than its figure.
  const roomy = useSectionSpan() >= GRID_COLUMNS / 2;
  const chart = roomy ? wideChart : undefined;
  const line = chart ? undefined : roomy && wideSpark ? wideSpark : spark;
  const body = (
    <>
      <div className="lumio-dashboard__stat-label">
        {/* The figure stays ink; the tone shows only as this dot and the sparkline. */}
        {tone !== 'neutral' && (
          <span
            className={`lumio-dashboard__stat-dot lumio-dashboard__stat-dot--${tone}`}
            aria-hidden="true"
          />
        )}
        {label}
      </div>
      <div className="lumio-dashboard__stat-value">{value}</div>
      {caption && (
        <div className="lumio-dashboard__stat-row">
          <span className="lumio-dashboard__stat-sub">{caption}</span>
        </div>
      )}
      {roomy && details && details.length > 0 && (
        <dl className="lumio-dashboard__stat-details">
          {details.map(detail => (
            <div key={detail.label}>
              <dt>{detail.label}</dt>
              <dd>{detail.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {chart && <div className="lumio-dashboard__stat-chart">{chart}</div>}
      {line && line.points.length >= 2 && (
        <div
          className={clsx(
            'lumio-dashboard__stat-spark',
            tone !== 'neutral' && `lumio-dashboard__stat-spark--${tone}`,
          )}
          aria-hidden="true"
        >
          <Sparkline points={line.points} />
        </div>
      )}
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="lumio-dashboard__stat lumio-dashboard__stat--link"
        data-attention={attentionId}
      >
        {body}
      </Link>
    );
  }
  return (
    <div className="lumio-dashboard__stat" data-attention={attentionId}>
      {body}
    </div>
  );
}
