'use client';

import type { getComparisonDelta } from '@/app/(main)/statements/components/shared-analytics.utils';
import { useAnalyticsMoney } from './useAnalyticsMoney';

type ComparisonItem = ReturnType<typeof getComparisonDelta> | null;
type Totals = { total: number; statementTotal: number; receiptTotal: number; operations: number };
type Comparison = {
  total: ComparisonItem;
  statementTotal: ComparisonItem;
  receiptTotal: ComparisonItem;
  operations: ComparisonItem;
} | null;

export type AnalyticsStatTilesProps = {
  totals: Totals;
  comparison: Comparison;
  isIncomeView: boolean;
  primaryMetricLabel: string;
  statementsLabel: string;
  receiptsLabel: string;
  operationsLabel: string;
  currency: string;
  noDataLabel: string;
  vsPreviousPeriodLabel: string;
};

/** "+100% (+$122.93) vs previous period", in grey: a change in spending is not an alarm. */
function ComparisonLine({
  item,
  format,
  noDataLabel,
  vsPreviousPeriodLabel,
}: {
  item: ComparisonItem;
  format: (value: number) => string;
  noDataLabel: string;
  vsPreviousPeriodLabel: string;
}): React.JSX.Element {
  const style = { margin: '6px 0 0', fontSize: 13, color: 'var(--text-muted)' } as const;
  if (!item) {
    return <p style={style}>{noDataLabel}</p>;
  }
  const sign = item.delta > 0 ? '+' : item.delta < 0 ? '−' : '';
  const percent = Number.isFinite(item.percentage)
    ? `${sign}${Math.abs(Math.round(item.percentage))}%`
    : '';
  return (
    <p style={style}>
      {percent} ({sign}
      {format(Math.abs(item.delta))}) {vsPreviousPeriodLabel}
    </p>
  );
}

function Tile({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="lumio-view-page__stat-card">
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>{label}</span>
      <div
        style={{
          marginTop: 6,
          fontSize: 24,
          fontWeight: 500,
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--foreground)',
        }}
      >
        {value}
      </div>
      {children}
    </div>
  );
}

/**
 * The four totals over a leaderboard's table: label, figure, change. No icons
 * and no colour — the arrows, pie and "#" in the corners said nothing the
 * label did not, and the green "+100%" made more spending look like good news.
 */
export function AnalyticsStatTiles({
  totals,
  comparison,
  primaryMetricLabel,
  statementsLabel,
  receiptsLabel,
  operationsLabel,
  currency,
  noDataLabel,
  vsPreviousPeriodLabel,
}: AnalyticsStatTilesProps): React.JSX.Element {
  const money = useAnalyticsMoney();
  const asMoney = (value: number) => money(value, currency);
  const asCount = (value: number) => String(Math.round(value));
  const line = (key: keyof NonNullable<Comparison>, format: (value: number) => string) => (
    <ComparisonLine
      item={comparison?.[key] ?? null}
      format={format}
      noDataLabel={noDataLabel}
      vsPreviousPeriodLabel={vsPreviousPeriodLabel}
    />
  );
  return (
    <div className="lumio-stat-tiles">
      <Tile label={primaryMetricLabel} value={asMoney(totals.total)}>
        {line('total', asMoney)}
      </Tile>
      <Tile label={statementsLabel} value={asMoney(totals.statementTotal)}>
        {line('statementTotal', asMoney)}
      </Tile>
      <Tile label={receiptsLabel} value={asMoney(totals.receiptTotal)}>
        {line('receiptTotal', asMoney)}
      </Tile>
      <Tile label={operationsLabel} value={asCount(totals.operations)}>
        {line('operations', asCount)}
      </Tile>
    </div>
  );
}
