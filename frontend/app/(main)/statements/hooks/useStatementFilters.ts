'use client';

import { useEffect, useMemo, useState } from 'react';
import { monthDeepLinkFilters } from '@/app/(main)/statements/components/filters/month-deep-link';
import {
  DEFAULT_STATEMENT_FILTERS,
  resetSingleStatementFilter,
  type StatementFilters,
} from '@/app/(main)/statements/components/filters/statement-filters';

const loadFilters = (storageKey: string): StatementFilters => {
  if (typeof window === 'undefined') {
    return DEFAULT_STATEMENT_FILTERS;
  }
  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    return DEFAULT_STATEMENT_FILTERS;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<StatementFilters>;
    return { ...DEFAULT_STATEMENT_FILTERS, ...parsed };
  } catch {
    return DEFAULT_STATEMENT_FILTERS;
  }
};

const saveFilters = (storageKey: string, filters: StatementFilters) => {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem(storageKey, JSON.stringify(filters));
};

export type UseStatementFiltersReturn = {
  draftFilters: StatementFilters;
  appliedFilters: StatementFilters;
  filtersDrawerScreen: string;
  typeDropdownOpen: boolean;
  statusDropdownOpen: boolean;
  dateDropdownOpen: boolean;
  fromDropdownOpen: boolean;
  filtersDrawerOpen: boolean;
  activeFilterCount: number;
  setFiltersDrawerScreen: (screen: string) => void;
  setTypeDropdownOpen: (open: boolean) => void;
  setStatusDropdownOpen: (open: boolean) => void;
  setDateDropdownOpen: (open: boolean) => void;
  setFromDropdownOpen: (open: boolean) => void;
  setFiltersDrawerOpen: (open: boolean) => void;
  setDraftFilters: (filters: StatementFilters) => void;
  updateFilter: (next: Partial<StatementFilters>) => void;
  applyFilterChanges: () => void;
  applyAndClose: (close: () => void) => void;
  resetAndClose: (key: keyof StatementFilters, close: () => void) => void;
  resetAllFilters: () => void;
};

/**
 * `deepLinkMonth` is the `?month=YYYY-MM` an advice or notification link
 * carries. It wins over the stored filters for that visit: the stored ones are
 * the user's own last view and would hide the very rows the link is about.
 * Nothing is written back, so the next plain visit is theirs again.
 */
export const useStatementFilters = (
  storageKey: string,
  deepLinkMonth?: string | null,
): UseStatementFiltersReturn => {
  const [draftFilters, setDraftFilters] = useState<StatementFilters>(DEFAULT_STATEMENT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<StatementFilters>(DEFAULT_STATEMENT_FILTERS);
  const [filtersDrawerScreen, setFiltersDrawerScreen] = useState('root');
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [fromDropdownOpen, setFromDropdownOpen] = useState(false);
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);

  useEffect(() => {
    const next = monthDeepLinkFilters(deepLinkMonth) ?? loadFilters(storageKey);
    setDraftFilters(next);
    setAppliedFilters(next);
  }, [storageKey, deepLinkMonth]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (appliedFilters.type) {
      count += 1;
    }
    if (appliedFilters.statuses.length > 0) {
      count += 1;
    }
    if (appliedFilters.date?.preset || appliedFilters.date?.mode) {
      count += 1;
    }
    if (appliedFilters.from.length > 0) {
      count += 1;
    }
    if (appliedFilters.to.length > 0) {
      count += 1;
    }
    if (appliedFilters.keywords.trim()) {
      count += 1;
    }
    if (appliedFilters.amountMin !== null || appliedFilters.amountMax !== null) {
      count += 1;
    }
    if (appliedFilters.approved !== null) {
      count += 1;
    }
    if (appliedFilters.billable !== null) {
      count += 1;
    }
    if (appliedFilters.groupBy) {
      count += 1;
    }
    if (appliedFilters.has.length > 0) {
      count += 1;
    }
    if (appliedFilters.currencies.length > 0) {
      count += 1;
    }
    if (appliedFilters.exported !== null) {
      count += 1;
    }
    if (appliedFilters.paid !== null) {
      count += 1;
    }
    if (appliedFilters.limit !== null) {
      count += 1;
    }
    return count;
  }, [appliedFilters]);

  const updateFilter = (next: Partial<StatementFilters>) => {
    setDraftFilters(prev => ({ ...prev, ...next }));
  };

  const applyFilterChanges = () => {
    setAppliedFilters(draftFilters);
    saveFilters(storageKey, draftFilters);
  };

  const applyAndClose = (close: () => void) => {
    applyFilterChanges();
    close();
  };

  const resetAndClose = (key: keyof StatementFilters, close: () => void) => {
    const next = resetSingleStatementFilter(draftFilters, key);
    setDraftFilters(next);
    setAppliedFilters(next);
    saveFilters(storageKey, next);
    close();
  };

  const resetAllFilters = () => {
    setDraftFilters(DEFAULT_STATEMENT_FILTERS);
    setAppliedFilters(DEFAULT_STATEMENT_FILTERS);
    saveFilters(storageKey, DEFAULT_STATEMENT_FILTERS);
  };

  return {
    draftFilters,
    appliedFilters,
    filtersDrawerScreen,
    typeDropdownOpen,
    statusDropdownOpen,
    dateDropdownOpen,
    fromDropdownOpen,
    filtersDrawerOpen,
    activeFilterCount,
    setFiltersDrawerScreen,
    setTypeDropdownOpen,
    setStatusDropdownOpen,
    setDateDropdownOpen,
    setFromDropdownOpen,
    setFiltersDrawerOpen,
    setDraftFilters,
    updateFilter,
    applyFilterChanges,
    applyAndClose,
    resetAndClose,
    resetAllFilters,
  };
};
