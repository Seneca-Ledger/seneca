'use client';

import { useEffect, useMemo, useState } from 'react';
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
import {
  deriveVisibleFilterScreens,
  reconcileFiltersWithColumns,
} from '@/app/(main)/statements/components/StatementsListView.utils';

export interface UseStatementsFilterStateResult {
  draftFilters: StatementFilters;
  appliedFilters: StatementFilters;
  setDraftFilters: React.Dispatch<React.SetStateAction<StatementFilters>>;
  setAppliedFilters: React.Dispatch<React.SetStateAction<StatementFilters>>;
  filtersDrawerScreen: string;
  setFiltersDrawerScreen: React.Dispatch<React.SetStateAction<string>>;
  typeDropdownOpen: boolean;
  setTypeDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  statusDropdownOpen: boolean;
  setStatusDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  dateDropdownOpen: boolean;
  setDateDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  fromDropdownOpen: boolean;
  setFromDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  filtersDrawerOpen: boolean;
  setFiltersDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  columnsDrawerOpen: boolean;
  setColumnsDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  columns: StatementColumn[];
  draftColumns: StatementColumn[];
  setDraftColumns: React.Dispatch<React.SetStateAction<StatementColumn[]>>;
  activeFilterCount: number;
  visibleFilterScreens: ReturnType<typeof deriveVisibleFilterScreens>;
  updateFilter: (next: Partial<StatementFilters>) => void;
  applyFilterChanges: () => void;
  applyAndClose: (close: () => void) => void;
  resetAndClose: (key: keyof StatementFilters, close: () => void) => void;
  resetAllFilters: () => void;
  updateColumnsToggle: (id: StatementColumnId, visible: boolean) => void;
  handleReorderColumns: (activeId: StatementColumnId, overId: StatementColumnId) => void;
  handleSaveColumns: () => void;
  handleColumnsOpen: () => void;
}

interface UseStatementsFilterStateParams {
  setPage: (page: number) => void;
}

// Each block = max 4 lines of `if (f.x) n += 1` to stay below complexity 6
function countFiltersA(f: StatementFilters): number {
  let n = 0;
  if (f.type) {
    n += 1;
  }
  if (f.statuses.length > 0) {
    n += 1;
  }
  if (f.from.length > 0) {
    n += 1;
  }
  if (f.to.length > 0) {
    n += 1;
  }
  return n;
}

function countFiltersB(f: StatementFilters): number {
  let n = 0;
  if (f.date?.preset) {
    n += 1;
  } else if (f.date?.mode) {
    n += 1;
  }
  if (f.keywords.trim()) {
    n += 1;
  }
  if (f.amountMin !== null || f.amountMax !== null) {
    n += 1;
  }
  return n;
}

function countFiltersC(f: StatementFilters): number {
  let n = 0;
  if (f.approved !== null) {
    n += 1;
  }
  if (f.billable !== null) {
    n += 1;
  }
  if (f.groupBy) {
    n += 1;
  }
  if (f.has.length > 0) {
    n += 1;
  }
  return n;
}

function countFiltersD(f: StatementFilters): number {
  let n = 0;
  if (f.currencies.length > 0) {
    n += 1;
  }
  if (f.exported !== null) {
    n += 1;
  }
  if (f.paid !== null) {
    n += 1;
  }
  if (f.limit !== null) {
    n += 1;
  }
  return n;
}

function countFilters(f: StatementFilters): number {
  return countFiltersA(f) + countFiltersB(f) + countFiltersC(f) + countFiltersD(f);
}

export function useStatementsFilterState({
  setPage,
}: UseStatementsFilterStateParams): UseStatementsFilterStateResult {
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

  useEffect(() => {
    const storedFilters = loadStatementFilters();
    setDraftFilters(storedFilters);
    setAppliedFilters(storedFilters);
    const storedColumns = loadStatementColumns();
    setColumns(storedColumns);
    setDraftColumns(storedColumns);
  }, []);

  const activeFilterCount = useMemo(() => countFilters(appliedFilters), [appliedFilters]);
  const visibleFilterScreens = useMemo(() => deriveVisibleFilterScreens(columns), [columns]);

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
    setDraftColumns(prev => prev.map(col => (col.id === id ? { ...col, visible } : col)));
  };

  const handleReorderColumns = (activeId: StatementColumnId, overId: StatementColumnId): void => {
    setDraftColumns(prev => reorderStatementColumns(prev, activeId, overId));
  };

  const handleSaveColumns = (): void => {
    const next = draftColumns.map((col, i) => ({ ...col, order: i }));
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
    setDraftFilters,
    setAppliedFilters,
    filtersDrawerScreen,
    setFiltersDrawerScreen,
    typeDropdownOpen,
    setTypeDropdownOpen,
    statusDropdownOpen,
    setStatusDropdownOpen,
    dateDropdownOpen,
    setDateDropdownOpen,
    fromDropdownOpen,
    setFromDropdownOpen,
    filtersDrawerOpen,
    setFiltersDrawerOpen,
    columnsDrawerOpen,
    setColumnsDrawerOpen,
    columns,
    draftColumns,
    setDraftColumns,
    activeFilterCount,
    visibleFilterScreens,
    updateFilter,
    applyFilterChanges,
    applyAndClose,
    resetAndClose,
    resetAllFilters,
    updateColumnsToggle,
    handleReorderColumns,
    handleSaveColumns,
    handleColumnsOpen,
  };
}
