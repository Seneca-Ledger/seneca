'use client';

import { useEffect, useState } from 'react';
import { Filter, Search, X } from '@/app/components/icons';
import { Select } from '@/app/components/ui/select';
import { useLocale } from '@/app/i18n';
import { getCategoryDisplayName } from '@/app/lib/statement-categories';
import type { Category, FilterState } from './types';

type FilterTranslations = {
  searchPlaceholder: { value: string };
  filters: { value: string };
  statusFilter: { value: string };
  statusAll: { value: string };
  statusWarnings: { value: string };
  statusErrors: { value: string };
  statusUncategorized: { value: string };
  categoryFilter: { value: string };
  categoryAll: { value: string };
  clearFilters: { value: string };
};

interface TransactionFiltersBarProps {
  filters: FilterState;
  categories: Category[];
  hasActiveFilters: boolean;
  showFilters: boolean;
  onFilterChange: (f: FilterState) => void;
  onToggleFilters: () => void;
  onClearFilters: () => void;
  t: FilterTranslations;
  /** Controls shown on the search row, before the Filters button (e.g. the currency toggle). */
  toolbarExtra?: React.ReactNode;
}

interface FilterToggleButtonProps {
  hasActiveFilters: boolean;
  activeCount: number;
  filterLabel: string;
  onClick: () => void;
}

function FilterToggleButton({
  hasActiveFilters,
  activeCount,
  filterLabel,
  onClick,
}: FilterToggleButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`seneca-tx-filters__toggle-btn${hasActiveFilters ? ' seneca-tx-filters__toggle-btn--active' : ''}`}
    >
      <Filter size={16} />
      {filterLabel}
      {hasActiveFilters && <span className="seneca-tx-filters__count">{activeCount}</span>}
    </button>
  );
}

interface StatusSelectProps {
  filters: FilterState;
  onFilterChange: (f: FilterState) => void;
  t: FilterTranslations;
}

function StatusSelect({ filters, onFilterChange, t }: StatusSelectProps): React.ReactElement {
  return (
    <div className="seneca-tx-filters__select-wrap">
      <label htmlFor="status-filter" className="seneca-tx-filters__label">
        {t.statusFilter.value}
      </label>
      <Select
        fullWidth
        id="status-filter"
        value={filters.status}
        onChange={value => onFilterChange({ ...filters, status: value as FilterState['status'] })}
        options={[
          { value: 'all', label: t.statusAll.value },
          { value: 'warnings', label: t.statusWarnings.value },
          { value: 'errors', label: t.statusErrors.value },
          { value: 'uncategorized', label: t.statusUncategorized.value },
        ]}
      />
    </div>
  );
}

interface CategorySelectProps {
  filters: FilterState;
  categories: Category[];
  onFilterChange: (f: FilterState) => void;
  t: FilterTranslations;
}

function CategorySelect({
  filters,
  categories,
  onFilterChange,
  t,
}: CategorySelectProps): React.ReactElement {
  const { locale } = useLocale();
  return (
    <div className="seneca-tx-filters__select-wrap">
      <label htmlFor="category-filter" className="seneca-tx-filters__label">
        {t.categoryFilter.value}
      </label>
      <Select
        fullWidth
        id="category-filter"
        value={filters.category ?? ''}
        onChange={value => onFilterChange({ ...filters, category: value || null })}
        options={[
          { value: '', label: t.categoryAll.value },
          ...categories.map(cat => ({
            value: cat.id,
            label: getCategoryDisplayName(cat, locale),
          })),
        ]}
      />
    </div>
  );
}

interface FilterPanelProps {
  filters: FilterState;
  categories: Category[];
  hasActiveFilters: boolean;
  onFilterChange: (f: FilterState) => void;
  onClearFilters: () => void;
  t: FilterTranslations;
}

function FilterPanel({
  filters,
  categories,
  hasActiveFilters,
  onFilterChange,
  onClearFilters,
  t,
}: FilterPanelProps): React.ReactElement {
  return (
    <div className="seneca-tx-filters__panel">
      <div className="seneca-tx-filters__panel-inner">
        <StatusSelect filters={filters} onFilterChange={onFilterChange} t={t} />
        <CategorySelect
          filters={filters}
          categories={categories}
          onFilterChange={onFilterChange}
          t={t}
        />
        {hasActiveFilters && (
          <button type="button" onClick={onClearFilters} className="seneca-tx-filters__clear-btn">
            {t.clearFilters.value}
          </button>
        )}
      </div>
    </div>
  );
}

export function TransactionFiltersBar({
  filters,
  categories,
  hasActiveFilters,
  showFilters,
  onFilterChange,
  onToggleFilters,
  onClearFilters,
  t,
  toolbarExtra,
}: TransactionFiltersBarProps): React.ReactElement {
  const activeCount = (filters.status !== 'all' ? 1 : 0) + (filters.category ? 1 : 0);

  // Typing updates a local draft; the (expensive) filter + sort of the whole
  // list only runs once the user pauses. External changes (clear buttons)
  // still win: they reset the draft during render.
  const [searchDraft, setSearchDraft] = useState(filters.search);
  const [syncedSearch, setSyncedSearch] = useState(filters.search);
  if (filters.search !== syncedSearch) {
    setSyncedSearch(filters.search);
    setSearchDraft(filters.search);
  }
  useEffect(() => {
    if (searchDraft === filters.search) return;
    const timer = setTimeout(() => onFilterChange({ ...filters, search: searchDraft }), 250);
    return () => clearTimeout(timer);
  }, [searchDraft, filters, onFilterChange]);

  return (
    <div className="seneca-tx-filters">
      <div className="seneca-tx-filters__top">
        <div className="seneca-tx-filters__search-wrap">
          <Search size={16} className="seneca-tx-filters__search-icon" />
          <input
            type="text"
            placeholder={t.searchPlaceholder.value}
            value={searchDraft}
            onChange={e => setSearchDraft(e.target.value)}
            className="seneca-tx-filters__search"
          />
          {searchDraft && (
            <button
              type="button"
              onClick={() => onFilterChange({ ...filters, search: '' })}
              className="seneca-tx-filters__clear-search"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="seneca-tx-filters__actions">
          {toolbarExtra}
          <FilterToggleButton
            hasActiveFilters={hasActiveFilters}
            activeCount={activeCount}
            filterLabel={t.filters.value}
            onClick={onToggleFilters}
          />
        </div>
      </div>
      {showFilters && (
        <FilterPanel
          filters={filters}
          categories={categories}
          hasActiveFilters={hasActiveFilters}
          onFilterChange={onFilterChange}
          onClearFilters={onClearFilters}
          t={t}
        />
      )}
    </div>
  );
}
