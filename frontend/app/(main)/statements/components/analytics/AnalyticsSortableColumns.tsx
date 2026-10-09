'use client';

/** The three numeric columns every analytics leaderboard can sort by. */
export type LeaderboardSortKey = 'amount' | 'average' | 'operations';

/**
 * Whatever the list is sorted by carries the emphasis, so a switch is visible
 * even when two orders coincide (one operation each: average = amount).
 */
export const sortedCellStyle = (
  column: LeaderboardSortKey,
  sortKey: LeaderboardSortKey,
): React.CSSProperties => ({
  padding: '8px 16px 8px 0',
  textAlign: 'right',
  ...(column === sortKey ? { fontWeight: 600, color: 'var(--foreground)' } : {}),
});

type SortableHeaderProps = {
  column: LeaderboardSortKey;
  sortKey: LeaderboardSortKey;
  label: string;
};

export function SortableHeader({ column, sortKey, label }: SortableHeaderProps): React.JSX.Element {
  const active = column === sortKey;
  return (
    <th
      aria-sort={active ? 'descending' : undefined}
      style={{
        padding: '8px 16px 8px 0',
        textAlign: 'right',
        ...(active ? { color: 'var(--foreground)' } : {}),
      }}
    >
      {label}
      {active ? <span aria-hidden> ↓</span> : null}
    </th>
  );
}
