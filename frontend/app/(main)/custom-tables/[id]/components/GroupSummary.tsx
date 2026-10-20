'use client';

import { PrivateAmount } from '@/app/components/ui/private-amount';
import type { TableGroup } from '../hooks/useTableGroups';
import { formatCellNumber } from '../utils/numberFormat';
import type { CustomTableColumn } from '../utils/types';
import { numberFormatFor } from './cells/formatCell';

interface GroupSummaryProps {
  groupColumn: CustomTableColumn;
  columns: CustomTableColumn[];
  groups: TableGroup[];
  loading: boolean;
  fallbackCurrency: string;
  onPick: (key: string | null) => void;
  labels: { title: string; empty: string; rows: string; loading: string };
}

const fill = (template: string, count: number) => template.replace('{{count}}', String(count));

/** Group totals for the active "group by" column; a click filters the grid. */
export function GroupSummary({
  groupColumn,
  columns,
  groups,
  loading,
  fallbackCurrency,
  onPick,
  labels,
}: GroupSummaryProps) {
  const formatAggregate = (col: string, value: number | string | null, fn: string) => {
    const column = columns.find(c => c.key === col);
    if (typeof value !== 'number') {
      return value ?? '—';
    }
    return formatCellNumber(
      value,
      column && fn !== 'count' ? numberFormatFor(column, fallbackCurrency) : {},
    );
  };
  // A total of a currency column is money; a count is not.
  const isMoneyAggregate = (col: string, value: number | string | null, fn: string) =>
    typeof value === 'number' &&
    fn !== 'count' &&
    columns.find(c => c.key === col)?.type === 'currency';
  return (
    <section className="seneca-ct__groups" aria-label={labels.title}>
      <h3 className="seneca-ct__groups-title">
        {labels.title}: {groupColumn.title}
      </h3>
      {loading ? <p className="seneca-ct__groups-hint">{labels.loading}</p> : null}
      {!loading && groups.length === 0 ? (
        <p className="seneca-ct__groups-hint">{labels.empty}</p>
      ) : null}
      <ul className="seneca-ct__groups-list">
        {groups.map(group => (
          <li key={group.key ?? '__null'}>
            <button type="button" className="seneca-ct__group" onClick={() => onPick(group.key)}>
              <span className="seneca-ct__group-key">{group.key ?? labels.empty}</span>
              <span className="seneca-ct__group-count">{fill(labels.rows, group.count)}</span>
              {group.aggregates.map(item => (
                <span key={`${item.col}:${item.fn}`} className="seneca-ct__group-agg">
                  {columns.find(c => c.key === item.col)?.title ?? item.col}:{' '}
                  {isMoneyAggregate(item.col, item.value, item.fn) ? (
                    <PrivateAmount>{formatAggregate(item.col, item.value, item.fn)}</PrivateAmount>
                  ) : (
                    formatAggregate(item.col, item.value, item.fn)
                  )}
                </span>
              ))}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
