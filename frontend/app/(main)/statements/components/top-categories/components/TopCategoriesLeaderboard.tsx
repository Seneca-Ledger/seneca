'use client';

import {
  SortableHeader,
  sortedCellStyle,
} from '@/app/(main)/statements/components/analytics/AnalyticsSortableColumns';
import { AnalyticsSourceBadge } from '@/app/(main)/statements/components/analytics/AnalyticsSourceBadge';
import { rowsWithFocused } from '@/app/(main)/statements/components/analytics/focus-rows';
import { useAnalyticsMoney } from '@/app/(main)/statements/components/analytics/useAnalyticsMoney';
import type {
  CategorySortKey,
  TopCategoryAggregateRow,
  TopCategorySourceChannel,
} from '@/app/(main)/statements/components/top-categories.utils';
import { EmptyStateIllustration } from '@/app/components/ui/EmptyStateIllustration';
import { PRIVATE_CLASS } from '@/app/components/ui/private-amount';
import { TextTabs } from '@/app/components/ui/text-tabs';
import { useCategoryName } from '@/app/lib/use-category-name';
import { formatStoredDate } from '@/app/lib/user-format-store';
import { tokens } from '@/lib/theme-tokens';

type SourceLabels = {
  sourceBank: string;
  sourceReceipt: string;
  sourceCrypto: string;
};
type SortLabels = { sortByAmount: string; sortByAverage: string; sortByOperations: string };
type ColumnLabels = {
  category: string;
  source: string;
  operations: string;
  average: string;
  amount: string;
  lastOperation: string;
};

type Props = {
  rows: TopCategoryAggregateRow[];
  sortKey: CategorySortKey;
  onSortChange: (key: CategorySortKey) => void;
  onRowClick: (id: string) => void;
  title: string;
  currency: string;
  sourceLabels: SourceLabels;
  sortLabels: SortLabels;
  columnLabels: ColumnLabels;
  emptyLabel: string;
  /** `?focus=category:<name>` from an advice link; that row is always drawn. */
  focusId?: string | null;
  /** How a row names itself; by default a category in the reader's language. */
  nameOf?: (name: string) => string;
  /** The `?focus=` prefix rows answer to: `category:` unless the rows are something else. */
  attentionPrefix?: string;
};

const SORT_KEYS: CategorySortKey[] = ['amount', 'average', 'operations'];

const attentionIdFor =
  (prefix: string) =>
  (row: TopCategoryAggregateRow): string =>
    `${prefix}${row.category.trim().toLowerCase()}`;

type RowProps = {
  row: TopCategoryAggregateRow;
  sortKey: CategorySortKey;
  attentionId: string;
  nameOf?: (name: string) => string;
  sourceLabels: SourceLabels;
  onRowClick: (id: string) => void;
};

function LeaderboardRow({
  row,
  sortKey,
  attentionId,
  nameOf,
  sourceLabels,
  onRowClick,
}: RowProps): React.JSX.Element {
  const money = useAnalyticsMoney();
  const categoryName = useCategoryName();
  const displayName = nameOf ?? categoryName;
  const lastDate =
    row.lastDate && !Number.isNaN(new Date(row.lastDate).getTime())
      ? formatStoredDate(row.lastDate)
      : '-';
  return (
    <tr
      // Target for `?focus=category:<name>` deep links; the leaderboard has no
      // category ids, rows are keyed by name.
      data-attention={attentionId}
      style={{ color: 'var(--foreground)', borderTop: '1px solid var(--border)' }}
    >
      <td style={{ padding: '8px 16px 8px 0', fontWeight: 500, color: 'var(--foreground)' }}>
        <button
          type="button"
          style={{
            textAlign: 'left',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            fontSize: 14,
          }}
          onClick={() => onRowClick(row.id)}
        >
          {displayName(row.category)}
        </button>
      </td>
      <td style={{ padding: '8px 16px 8px 0' }}>
        <AnalyticsSourceBadge
          sourceChannel={row.sourceChannel as TopCategorySourceChannel}
          labels={sourceLabels}
        />
      </td>
      <td style={sortedCellStyle('operations', sortKey)}>{row.count}</td>
      <td className={PRIVATE_CLASS} style={sortedCellStyle('average', sortKey)}>
        {money(row.average, row.currency)}
      </td>
      <td className={PRIVATE_CLASS} style={sortedCellStyle('amount', sortKey)}>
        {money(row.total, row.currency)}
      </td>
      <td style={{ padding: '8px 0', textAlign: 'right', color: 'var(--muted-foreground)' }}>
        {lastDate}
      </td>
    </tr>
  );
}

export function TopCategoriesLeaderboard({
  rows,
  sortKey,
  onSortChange,
  onRowClick,
  title,
  sourceLabels,
  sortLabels,
  columnLabels,
  emptyLabel,
  focusId = null,
  nameOf,
  attentionPrefix = 'category:',
}: Props): React.JSX.Element {
  const attentionIdOf = attentionIdFor(attentionPrefix);
  const visibleRows = rowsWithFocused(rows, attentionIdOf, focusId);
  const sortKeyLabels: Record<CategorySortKey, string> = {
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
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--foreground)' }}>
            {title}
          </h3>
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{rows.length}</span>
        </div>
        {/* Sort order as text tabs, like every other switch on the page. */}
        <TextTabs
          value={sortKey}
          onChange={onSortChange}
          ariaLabel={sortKeyLabels[sortKey]}
          options={SORT_KEYS.map(key => ({ value: key, label: sortKeyLabels[key] }))}
        />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ minWidth: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
          <thead>
            <tr
              style={{
                textAlign: 'left',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text-muted)',
              }}
            >
              <th style={{ padding: '8px 16px 8px 0' }}>{columnLabels.category}</th>
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
            {visibleRows.map(row => (
              <LeaderboardRow
                key={row.id}
                row={row}
                sortKey={sortKey}
                attentionId={attentionIdOf(row)}
                nameOf={nameOf}
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
