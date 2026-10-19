'use client';

import { useCurrencyDisplay } from '@/app/contexts/CurrencyDisplayContext';
import { useIsMobile } from '@/app/hooks/useIsMobile';
import { useIntlayer, useLocale } from '@/app/i18n';
import { useTransactionFormatters } from './hooks/useTransactionFormatters';
import { useTransactionsTable } from './hooks/useTransactionsTable';
import { TransactionDesktopTable } from './TransactionDesktopTable';
import { TransactionFiltersBar } from './TransactionFiltersBar';
import { TransactionMobileList } from './TransactionMobileList';
import { TransactionPagination } from './TransactionPagination';
import type { Category, FilterState, Transaction, UpdateCategoryFn } from './types';

interface TransactionsTableProps {
  transactions: Transaction[];
  categories: Category[];
  selectedIds: string[];
  onSelectRows: (ids: string[]) => void;
  onRowClick: (transaction: Transaction) => void;
  onUpdateCategory?: UpdateCategoryFn;
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  toolbarExtra?: React.ReactNode;
}

export default function TransactionsTable({
  transactions,
  categories,
  selectedIds,
  onSelectRows,
  onRowClick,
  onUpdateCategory,
  filters,
  onFilterChange,
  toolbarExtra,
}: TransactionsTableProps): React.ReactElement {
  const { locale } = useLocale();
  const t = useIntlayer('transactionsTable');
  const isMobile = useIsMobile();
  const { showConverted } = useCurrencyDisplay();
  const state = useTransactionsTable({
    transactions,
    filters,
    selectedIds,
    onSelectRows,
    onFilterChange,
  });
  const formatters = useTransactionFormatters(locale, showConverted);
  const handlers = {
    onRowClick,
    onToggleExpansion: state.toggleExpansion,
    onSelectRow: state.handleSelectRow,
    onUpdateCategory,
  };
  const sharedProps = {
    transactions: state.paginatedTransactions,
    categories,
    selectedIds,
    expandedIds: state.expandedIds,
    sort: state.sort,
    allSelected: state.allSelected,
    someSelected: state.someSelected,
    handlers,
    formatters,
    onSelectAll: state.handleSelectAll,
    onToggleSort: state.toggleSort,
    noResultsLabel: t.noResults.value,
    categoryLabel: t.categoryFilter.value,
    uncategorizedLabel: t.statusUncategorized.value,
    columnBinLabel: t.columnBin.value,
    columnDateLabel: t.columnDate.value,
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <TransactionFiltersBar
        filters={filters}
        categories={categories}
        hasActiveFilters={state.hasActiveFilters}
        showFilters={state.showFilters}
        onFilterChange={onFilterChange}
        onToggleFilters={() => state.setShowFilters(!state.showFilters)}
        onClearFilters={state.clearFilters}
        t={t}
        toolbarExtra={toolbarExtra}
      />
      {isMobile ? (
        <TransactionMobileList
          {...sharedProps}
          allTransactionsCount={state.filteredAndSortedTransactions.length}
          columnDateSortLabel={t.columnDate.value}
        />
      ) : (
        <TransactionDesktopTable {...sharedProps} t={t} />
      )}
      {state.filteredAndSortedTransactions.length > 0 && (
        <TransactionPagination
          page={state.page}
          rowsPerPage={state.rowsPerPage}
          totalPages={state.totalPages}
          totalCount={state.filteredAndSortedTransactions.length}
          rowsPerPageLabel={t.rowsPerPage.value}
          ofLabel={t.of.value}
          onPageChange={state.setPage}
          onRowsPerPageChange={state.setRowsPerPage}
        />
      )}
    </div>
  );
}
