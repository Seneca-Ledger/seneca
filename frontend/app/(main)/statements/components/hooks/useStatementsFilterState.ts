'use client';

import { useState } from 'react';
import {
  DEFAULT_STATEMENT_COLUMNS,
  loadStatementColumns,
  reorderStatementColumns,
  type StatementColumn,
  type StatementColumnId,
  saveStatementColumns,
} from '@/app/(main)/statements/components/columns/statement-columns';
import {
  DEFAULT_STATEMENT_FILTERS,
  loadStatementFilters,
  resetSingleStatementFilter,
  type StatementFilters,
  saveStatementFilters,
} from '@/app/(main)/statements/components/filters/statement-filters';
import { monthDeepLinkFilters } from '../filters/month-deep-link';
import { reconcileFiltersWithColumns } from '../StatementsListView.utils';

interface UseStatementsFilterStateReturn {
  draftFilters: StatementFilters;
  appliedFilters: StatementFilters;
  columns: StatementColumn[];
  draftColumns: StatementColumn[];
  filtersDrawerScreen: string;
  typeDropdownOpen: boolean;
  statusDropdownOpen: boolean;
  dateDropdownOpen: boolean;
  fromDropdownOpen: boolean;
  filtersDrawerOpen: boolean;
  columnsDrawerOpen: boolean;
  setDraftFilters: (filters: StatementFilters) => void;
  setAppliedFilters: (filters: StatementFilters) => void;
  setColumns: (columns: StatementColumn[]) => void;
  setDraftColumns: (columns: StatementColumn[]) => void;
  setFiltersDrawerScreen: (screen: string) => void;
  setTypeDropdownOpen: (open: boolean) => void;
  setStatusDropdownOpen: (open: boolean) => void;
  setDateDropdownOpen: (open: boolean) => void;
  setFromDropdownOpen: (open: boolean) => void;
  setFiltersDrawerOpen: (open: boolean) => void;
  setColumnsDrawerOpen: (open: boolean) => void;
  setPage: (page: number) => void;
  updateFilter: (next: Partial<StatementFilters>) => void;
  applyFilterChanges: () => void;
  applyAndClose: (close: () => void) => void;
  resetAndClose: (key: keyof StatementFilters, close: () => void) => void;
  resetAllFilters: () => void;
  updateColumnsToggle: (id: StatementColumnId, visible: boolean) => void;
  handleReorderColumns: (activeId: StatementColumnId, overId: StatementColumnId) => void;
  handleSaveColumns: () => void;
  handleColumnsOpen: () => void;
  /** `deepLinkMonth` (`?month=YYYY-MM`) wins over the stored filters for this visit, unsaved. */
  initFromStorage: (deepLinkMonth?: string | null) => void;
}

export function useStatementsFilterState({
  setPage,
}: {
  setPage: (page: number) => void;
}): UseStatementsFilterStateReturn {
  const [draftFilters, setDraftFilters] = useState<StatementFilters>(DEFAULT_STATEMENT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<StatementFilters>(DEFAULT_STATEMENT_FILTERS);
  const [filtersDrawerScreen, setFiltersDrawerScreen] = useState('root');
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [fromDropdownOpen, setFromDropdownOpen] = useState(false);
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [columnsDrawerOpen, setColumnsDrawerOpen] = useState(false);
  const [columns, setColumns] = useState<StatementColumn[]>(DEFAULT_STATEMENT_COLUMNS);
  const [draftColumns, setDraftColumns] = useState<StatementColumn[]>(DEFAULT_STATEMENT_COLUMNS);

  const initFromStorage = (deepLinkMonth?: string | null): void => {
    const storedFilters = monthDeepLinkFilters(deepLinkMonth) ?? loadStatementFilters();
    setDraftFilters(storedFilters);
    setAppliedFilters(storedFilters);
    const storedColumns = loadStatementColumns();
    setColumns(storedColumns);
    setDraftColumns(storedColumns);
  };

  const updateFilter = (next: Partial<StatementFilters>): void => {
    setDraftFilters(prev => ({ ...prev, ...next }));
  };

  const applyFilterChanges = (): void => {
    setAppliedFilters(draftFilters);
    saveStatementFilters(draftFilters);
    setPage(1);
  };

  const applyAndClose = (close: () => void): void => {
    applyFilterChanges();
    close();
  };

  const resetAndClose = (key: keyof StatementFilters, close: () => void): void => {
    const next = resetSingleStatementFilter(draftFilters, key);
    setDraftFilters(next);
    setAppliedFilters(next);
    saveStatementFilters(next);
    close();
  };

  const resetAllFilters = (): void => {
    setDraftFilters(DEFAULT_STATEMENT_FILTERS);
    setAppliedFilters(DEFAULT_STATEMENT_FILTERS);
    saveStatementFilters(DEFAULT_STATEMENT_FILTERS);
    setPage(1);
  };

  const updateColumnsToggle = (id: StatementColumnId, visible: boolean): void => {
    setDraftColumns(prev =>
      prev.map(column => (column.id === id ? { ...column, visible } : column)),
    );
  };

  const handleReorderColumns = (activeId: StatementColumnId, overId: StatementColumnId): void => {
    setDraftColumns(prev => reorderStatementColumns(prev, activeId, overId));
  };

  const handleSaveColumns = (): void => {
    const next = draftColumns.map((column, index) => ({ ...column, order: index }));
    const { nextAppliedFilters, nextDraftFilters } = reconcileFiltersWithColumns({
      columns: next,
      appliedFilters,
      draftFilters,
    });
    setColumns(next);
    setDraftFilters(nextDraftFilters);
    setAppliedFilters(nextAppliedFilters);
    saveStatementColumns(next);
    saveStatementFilters(nextAppliedFilters);
    setColumnsDrawerOpen(false);
  };

  const handleColumnsOpen = (): void => {
    setDraftColumns(columns);
    setColumnsDrawerOpen(true);
  };

  return {
    draftFilters,
    appliedFilters,
    columns,
    draftColumns,
    filtersDrawerScreen,
    typeDropdownOpen,
    statusDropdownOpen,
    dateDropdownOpen,
    fromDropdownOpen,
    filtersDrawerOpen,
    columnsDrawerOpen,
    setDraftFilters,
    setAppliedFilters,
    setColumns,
    setDraftColumns,
    setFiltersDrawerScreen,
    setTypeDropdownOpen,
    setStatusDropdownOpen,
    setDateDropdownOpen,
    setFromDropdownOpen,
    setFiltersDrawerOpen,
    setColumnsDrawerOpen,
    setPage,
    updateFilter,
    applyFilterChanges,
    applyAndClose,
    resetAndClose,
    resetAllFilters,
    updateColumnsToggle,
    handleReorderColumns,
    handleSaveColumns,
    handleColumnsOpen,
    initFromStorage,
  };
}
