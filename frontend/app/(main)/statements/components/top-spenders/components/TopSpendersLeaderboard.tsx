'use client';

import {
  SortableHeader,
  sortedCellStyle,
} from '@/app/(main)/statements/components/analytics/AnalyticsSortableColumns';
import { AnalyticsSourceBadge } from '@/app/(main)/statements/components/analytics/AnalyticsSourceBadge';
import type {
  AggregateSortKey,
  TopSpenderAggregateRow,
  TopSpenderSourceChannel,
} from '@/app/(main)/statements/components/top-spenders/top-spenders.types';
import { EmptyStateIllustration } from '@/app/components/ui/EmptyStateIllustration';
import { formatMoney } from '@/app/lib/analytics-common';
import { formatStoredDate } from '@/app/lib/user-format-store';
import { tokens } from '@/lib/theme-tokens';

type SourceLabels = {
  sourceBank: string;
  sourceReceipt: string;
  sourceGmailInbox: string;
  sourceCrypto: string;
};
type SortLabels = { sortByAmount: string; sortByAverage: string; sortByOperations: string };
type ColumnLabels = {
  company: string;
  source: string;
  operations: string;
  average: string;
  amount: string;
  lastOperation: string;
};

type Props = {
  rows: TopSpenderAggregateRow[];
  sortKey: AggregateSortKey;
  onSortChange: (key: AggregateSortKey) => void;
  onRowClick: (id: string) => void;
  title: string;
  currency: string;
  sourceLabels: SourceLabels;
  sortLabels: SortLabels;
  columnLabels: ColumnLabels;
  emptyLabel: string;
};

const SORT_KEYS: AggregateSortKey[] = ['amount', 'average', 'operations'];

type SortBtnProps = { label: string; active: boolean; onClick: () => void };

function SortBtn({ label, active, onClick }: SortBtnProps): React.JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={active}
      style={{
        borderRadius: tokens.radius.sm,
        padding: '4px 10px',
        fontSize: 12,
        fontWeight: 500,
        background: active ? 'var(--card-bg)' : 'transparent',
        color: active ? 'var(--foreground)' : 'var(--text-secondary)',
        border: 'none',
        cursor: 'pointer',
        boxShadow: active ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
      }}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

type RowProps = {
  row: TopSpenderAggregateRow;
  sortKey: AggregateSortKey;
  sourceLabels: SourceLabels;
  onRowClick: (id: string) => void;
};

function LeaderboardRow({ row, sortKey, sourceLabels, onRowClick }: RowProps): React.JSX.Element {
  const lastDate =
    row.lastDate && !Number.isNaN(new Date(row.lastDate).getTime())
      ? formatStoredDate(row.lastDate)
      : '-';
  return (
    <tr style={{ color: 'var(--foreground)', borderTop: '1px solid var(--muted)' }}>
      <td style={{ padding: '8px 16px 8px 0', fontWeight: 500, color: 'var(--foreground)' }}>
        <button
          type="button"
          style={{
            textAlign: 'left',
            color: 'var(--primary)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            fontSize: 14,
          }}
          onClick={() => onRowClick(row.id)}
        >
          {row.company}
        </button>
      </td>
      <td style={{ padding: '8px 16px 8px 0' }}>
        <AnalyticsSourceBadge
          sourceChannel={row.sourceChannel as TopSpenderSourceChannel}
          labels={sourceLabels}
        />
      </td>
      <td style={sortedCellStyle('operations', sortKey)}>{row.count}</td>
      <td style={sortedCellStyle('average', sortKey)}>{formatMoney(row.average, row.currency)}</td>
      <td style={sortedCellStyle('amount', sortKey)}>{formatMoney(row.total, row.currency)}</td>
      <td style={{ padding: '8px 0', textAlign: 'right', color: 'var(--muted-foreground)' }}>
        {lastDate}
      </td>
    </tr>
  );
}

export function TopSpendersLeaderboard({
  rows,
  sortKey,
  onSortChange,
  onRowClick,
  title,
  sourceLabels,
  sortLabels,
  columnLabels,
  emptyLabel,
}: Props): React.JSX.Element {
  const sortKeyLabels: Record<AggregateSortKey, string> = {
    amount: sortLabels.sortByAmount,
    average: sortLabels.sortByAverage,
    operations: sortLabels.sortByOperations,
  };
  return (
    <div
      style={{
        border: '1px solid var(--border-color)',
        background: 'var(--card-bg)',
        padding: 20,
        borderRadius: tokens.radius.lg,
      }}
    >
      <div
        style={{
          marginBottom: 8,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{title}</h3>
          <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{rows.length}</span>
        </div>
        <div
          style={{
            display: 'inline-flex',
            border: '1px solid var(--border-color)',
            background: 'var(--muted)',
            padding: 4,
            borderRadius: tokens.radius.md,
          }}
        >
          {SORT_KEYS.map(k => (
            <SortBtn
              key={k}
              label={sortKeyLabels[k]}
              active={sortKey === k}
              onClick={() => onSortChange(k)}
            />
          ))}
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ minWidth: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
          <thead>
            <tr
              style={{
                textAlign: 'left',
                fontSize: 12,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--muted-foreground)',
              }}
            >
              <th style={{ padding: '8px 16px 8px 0' }}>{columnLabels.company}</th>
              <th style={{ padding: '8px 16px 8px 0' }}>{columnLabels.source}</th>
              <SortableHeader
                column="operations"
                sortKey={sortKey}
                label={columnLabels.operations}
              />
              <SortableHeader column="average" sortKey={sortKey} label={columnLabels.average} />
              <SortableHeader column="amount" sortKey={sortKey} label={columnLabels.amount} />
              <th style={{ padding: '8px 0', textAlign: 'right' }}>{columnLabels.lastOperation}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '32px 0', textAlign: 'center' }}>
                  <EmptyStateIllustration name="money-bag" size="md" />
                  <span style={{ color: 'var(--muted-foreground)' }}>{emptyLabel}</span>
                </td>
              </tr>
            ) : null}
            {rows.slice(0, 60).map(row => (
              <LeaderboardRow
                key={row.id}
                row={row}
                sortKey={sortKey}
                sourceLabels={sourceLabels}
                onRowClick={onRowClick}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
