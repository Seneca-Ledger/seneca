'use client';

import { EmptyStateIllustration } from '@/app/components/ui/EmptyStateIllustration';
import { Checkbox } from '../ui/checkbox';
import type { TransactionRowFormatters, TransactionRowHandlers } from './TransactionRow';
import { SortIcon, TransactionRow } from './TransactionRow';
import type { Category, SortState, Transaction } from './types';

interface TableHeaderProps {
  sort: SortState;
  allSelected: boolean;
  someSelected: boolean;
  onSelectAll: (checked: boolean) => void;
  onToggleSort: (by: SortState['by']) => void;
  t: ColumnTranslations;
}

type ColumnTranslations = {
  columnDate: { value: string };
  columnCounterparty: { value: string };
  columnPurpose: { value: string };
  columnDebit: { value: string };
  columnCredit: { value: string };
  columnCategory: { value: string };
};

function TableHeader({
  sort,
  allSelected,
  someSelected,
  onSelectAll,
  onToggleSort,
  t,
}: TableHeaderProps): React.ReactElement {
  return (
    <thead className="seneca-tx-table__thead">
      <tr>
        <th className="seneca-tx-table__th--expand" />
        <th className="seneca-tx-table__th--checkbox">
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected && !allSelected}
            onCheckedChange={onSelectAll}
            style={{ height: 20, width: 20 }}
          />
        </th>
        <th className="seneca-tx-table__th">
          <button
            type="button"
            onClick={() => onToggleSort('date')}
            className="seneca-tx-table__sort-btn"
          >
            {t.columnDate.value}
            <SortIcon sort={sort} field="date" />
          </button>
        </th>
        <th className="seneca-tx-table__th">{t.columnCounterparty.value}</th>
        <th className="seneca-tx-table__th">{t.columnPurpose.value}</th>
        <th className="seneca-tx-table__th--right">
          <button
            type="button"
            onClick={() => onToggleSort('amount')}
            className="seneca-tx-table__sort-btn"
          >
            {t.columnDebit.value}
            <SortIcon sort={sort} field="amount" />
          </button>
        </th>
        <th className="seneca-tx-table__th--right">{t.columnCredit.value}</th>
        <th className="seneca-tx-table__th">{t.columnCategory.value}</th>
      </tr>
    </thead>
  );
}

interface TransactionDesktopTableProps {
  transactions: Transaction[];
  categories: Category[];
  selectedIds: string[];
  expandedIds: Set<string>;
  sort: SortState;
  allSelected: boolean;
  someSelected: boolean;
  handlers: TransactionRowHandlers;
  formatters: TransactionRowFormatters;
  onSelectAll: (checked: boolean) => void;
  onToggleSort: (by: SortState['by']) => void;
  noResultsLabel: string;
  categoryLabel: string;
  uncategorizedLabel: string;
  columnBinLabel: string;
  columnDateLabel: string;
  t: ColumnTranslations;
}

export function TransactionDesktopTable({
  transactions,
  categories,
  selectedIds,
  expandedIds,
  sort,
  allSelected,
  someSelected,
  handlers,
  formatters,
  onSelectAll,
  onToggleSort,
  noResultsLabel,
  categoryLabel,
  uncategorizedLabel,
  columnBinLabel,
  columnDateLabel,
  t,
}: TransactionDesktopTableProps): React.ReactElement {
  return (
    <div className="seneca-tx-table">
      <div className="seneca-tx-table__scroll">
        <table className="seneca-tx-table__table">
          <TableHeader
            sort={sort}
            allSelected={allSelected}
            someSelected={someSelected}
            onSelectAll={onSelectAll}
            onToggleSort={onToggleSort}
            t={t}
          />
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={9} className="seneca-tx-table__no-results">
                  <EmptyStateIllustration name="transactions" size="md" />
                  {noResultsLabel}
                </td>
              </tr>
            ) : (
              transactions.map(tx => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  isExpanded={expandedIds.has(tx.id)}
                  isSelected={selectedIds.includes(tx.id)}
                  categories={categories}
                  handlers={handlers}
                  formatters={formatters}
                  categoryLabel={categoryLabel}
                  uncategorizedLabel={uncategorizedLabel}
                  columnBinLabel={columnBinLabel}
                  columnDateLabel={columnDateLabel}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
