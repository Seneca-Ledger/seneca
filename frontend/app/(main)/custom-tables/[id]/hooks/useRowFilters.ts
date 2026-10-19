'use client';

import { useCallback, useMemo, useState } from 'react';
import type { CustomTableColumn, RowFilter, RowFilterOp } from '../utils/types';

export interface ActiveFilter extends RowFilter {
  /** Stable key so chips keep identity while the list changes. */
  id: string;
}

export interface UseRowFiltersReturn {
  filters: ActiveFilter[];
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  addFilter: (filter: RowFilter) => void;
  removeFilter: (id: string) => void;
  clearFilters: () => void;
  /** JSON for GET /rows `filters`; undefined when nothing is active. */
  filtersParam: string | undefined;
}

let filterSeq = 0;

/** Operators the UI offers per column type; the server accepts all of them. */
export function operatorsForColumn(column: CustomTableColumn): RowFilterOp[] {
  switch (column.type) {
    case 'number':
    case 'currency':
    case 'formula':
      return ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'isEmpty', 'isNotEmpty'];
    case 'date':
      return ['eq', 'gte', 'lte', 'between', 'isEmpty', 'isNotEmpty'];
    case 'boolean':
      return ['eq'];
    case 'select':
    case 'multi_select':
      return ['eq', 'neq', 'isEmpty', 'isNotEmpty'];
    default:
      return ['contains', 'eq', 'neq', 'startsWith', 'isEmpty', 'isNotEmpty'];
  }
}

export const NO_VALUE_OPS: ReadonlySet<RowFilterOp> = new Set(['isEmpty', 'isNotEmpty']);

/**
 * Column filters + free-text search, serialised the way GET /rows expects.
 * Search goes through the server's `__search__` pseudo-column so it matches
 * across every text column without the client knowing which ones exist.
 */
export function useRowFilters(): UseRowFiltersReturn {
  const [filters, setFilters] = useState<ActiveFilter[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const addFilter = useCallback((filter: RowFilter) => {
    filterSeq += 1;
    setFilters(prev => [...prev, { ...filter, id: `f${filterSeq}` }]);
  }, []);

  const removeFilter = useCallback((id: string) => {
    setFilters(prev => prev.filter(f => f.id !== id));
  }, []);

  const clearFilters = useCallback(() => setFilters([]), []);

  const filtersParam = useMemo(() => {
    const list: RowFilter[] = filters.map(({ col, op, value }) => ({ col, op, value }));
    const search = searchQuery.trim();
    if (search) {
      list.push({ col: '__search__', op: 'search', value: search });
    }
    return list.length ? JSON.stringify(list) : undefined;
  }, [filters, searchQuery]);

  return {
    filters,
    searchQuery,
    setSearchQuery,
    addFilter,
    removeFilter,
    clearFilters,
    filtersParam,
  };
}
