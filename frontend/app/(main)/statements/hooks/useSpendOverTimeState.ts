'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_STATEMENT_FILTERS,
  resetSingleStatementFilter,
  type StatementFilters,
} from '@/app/(main)/statements/components/filters/statement-filters';
import type {
  SpendOverTimeFlowType,
  SpendOverTimeGroupBy,
} from '@/app/(main)/statements/components/spend-over-time.utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewTypeValue = 'calendar' | 'line' | 'bar' | 'stacked';
type WorkspaceFilterValue = 'current' | 'all' | string;

type StoredState = {
  filters: StatementFilters;
  groupBy: SpendOverTimeGroupBy;
  viewType: ViewTypeValue;
  workspaceFilter: WorkspaceFilterValue;
  activeFlowType: SpendOverTimeFlowType;
};

export interface UseSpendOverTimeStateReturn {
  workspaceFilter: WorkspaceFilterValue;
  setWorkspaceFilter: (v: WorkspaceFilterValue) => void;
  activeFlowType: SpendOverTimeFlowType;
  setActiveFlowType: (v: SpendOverTimeFlowType) => void;
  groupBy: SpendOverTimeGroupBy;
  draftGroupBy: SpendOverTimeGroupBy;
  setGroupBy: (v: SpendOverTimeGroupBy) => void;
  setDraftGroupBy: (v: SpendOverTimeGroupBy) => void;
  viewType: ViewTypeValue;
  draftViewType: ViewTypeValue;
  setViewType: (v: ViewTypeValue) => void;
  setDraftViewType: (v: ViewTypeValue) => void;
  groupByDropdownOpen: boolean;
  setGroupByDropdownOpen: (v: boolean) => void;
  viewDropdownOpen: boolean;
  setViewDropdownOpen: (v: boolean) => void;
  draftFilters: StatementFilters;
  appliedFilters: StatementFilters;
  setDraftFilters: (
    filters: StatementFilters | ((prev: StatementFilters) => StatementFilters),
  ) => void;
  typeDropdownOpen: boolean;
  statusDropdownOpen: boolean;
  dateDropdownOpen: boolean;
  fromDropdownOpen: boolean;
  filtersDrawerOpen: boolean;
  filtersDrawerScreen: string;
  activeFilterCount: number;
  setTypeDropdownOpen: (v: boolean) => void;
  setStatusDropdownOpen: (v: boolean) => void;
  setDateDropdownOpen: (v: boolean) => void;
  setFromDropdownOpen: (v: boolean) => void;
  setFiltersDrawerOpen: (v: boolean) => void;
  setFiltersDrawerScreen: (v: string) => void;
  updateFilter: (next: Partial<StatementFilters>) => void;
  applyFilterChanges: () => void;
  applyAndClose: (close: () => void) => void;
  resetAndClose: (key: keyof StatementFilters, close: () => void) => void;
  resetAllFilters: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEFAULT_SPEND_OVER_TIME_GROUP_BY: SpendOverTimeGroupBy = 'day';
export const DEFAULT_SPEND_OVER_TIME_VIEW: ViewTypeValue = 'calendar';
const DEFAULT_FLOW: SpendOverTimeFlowType = 'expense';

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line complexity
const loadStoredState = (storageKey: string): StoredState => {
  if (typeof window === 'undefined') {
    return {
      filters: DEFAULT_STATEMENT_FILTERS,
      groupBy: DEFAULT_SPEND_OVER_TIME_GROUP_BY,
      viewType: DEFAULT_SPEND_OVER_TIME_VIEW,
      workspaceFilter: 'current',
      activeFlowType: DEFAULT_FLOW,
    };
  }

  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    return {
      filters: DEFAULT_STATEMENT_FILTERS,
      groupBy: DEFAULT_SPEND_OVER_TIME_GROUP_BY,
      viewType: DEFAULT_SPEND_OVER_TIME_VIEW,
      workspaceFilter: 'current',
      activeFlowType: DEFAULT_FLOW,
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    return {
      filters: { ...DEFAULT_STATEMENT_FILTERS, ...parsed.filters },
      groupBy: parsed.groupBy || DEFAULT_SPEND_OVER_TIME_GROUP_BY,
      viewType: parsed.viewType || DEFAULT_SPEND_OVER_TIME_VIEW,
      workspaceFilter: parsed.workspaceFilter || 'current',
      activeFlowType: parsed.activeFlowType || DEFAULT_FLOW,
    };
  } catch {
    return {
      filters: DEFAULT_STATEMENT_FILTERS,
      groupBy: DEFAULT_SPEND_OVER_TIME_GROUP_BY,
      viewType: DEFAULT_SPEND_OVER_TIME_VIEW,
      workspaceFilter: 'current',
      activeFlowType: DEFAULT_FLOW,
    };
  }
};

const saveStoredState = (storageKey: string, state: StoredState): void => {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem(storageKey, JSON.stringify(state));
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

// eslint-disable-next-line max-lines-per-function
export function useSpendOverTimeState(storageKey: string): UseSpendOverTimeStateReturn {
  const initial = loadStoredState(storageKey);

  const [workspaceFilter, setWorkspaceFilter] = useState<WorkspaceFilterValue>(
    initial.workspaceFilter,
  );
  const [activeFlowType, setActiveFlowType] = useState<SpendOverTimeFlowType>(
    initial.activeFlowType,
  );
  const [groupBy, setGroupBy] = useState<SpendOverTimeGroupBy>(initial.groupBy);
  const [draftGroupBy, setDraftGroupBy] = useState<SpendOverTimeGroupBy>(initial.groupBy);
  const [viewType, setViewType] = useState<ViewTypeValue>(initial.viewType);
  const [draftViewType, setDraftViewType] = useState<ViewTypeValue>(initial.viewType);
  const [groupByDropdownOpen, setGroupByDropdownOpen] = useState(false);
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<StatementFilters>(initial.filters);
  const [appliedFilters, setAppliedFilters] = useState<StatementFilters>(initial.filters);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [fromDropdownOpen, setFromDropdownOpen] = useState(false);
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [filtersDrawerScreen, setFiltersDrawerScreen] = useState('root');

  useEffect(() => {
    saveStoredState(storageKey, {
      filters: appliedFilters,
      groupBy,
      viewType,
      workspaceFilter,
      activeFlowType,
    });
  }, [storageKey, appliedFilters, groupBy, viewType, workspaceFilter, activeFlowType]);

  // eslint-disable-next-line complexity
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

  const updateFilter = (next: Partial<StatementFilters>): void => {
    setDraftFilters(prev => ({ ...prev, ...next }));
  };

  const applyFilterChanges = (): void => {
    setAppliedFilters(draftFilters);
    setGroupBy(draftViewType === 'calendar' ? 'day' : draftGroupBy);
    setViewType(draftViewType);
  };

  const applyAndClose = (close: () => void): void => {
    applyFilterChanges();
    close();
  };

  const resetAndClose = (key: keyof StatementFilters, close: () => void): void => {
    const next = resetSingleStatementFilter(draftFilters, key);
    setDraftFilters(next);
    setAppliedFilters(next);
    close();
  };

  const resetAllFilters = (): void => {
    setDraftFilters(DEFAULT_STATEMENT_FILTERS);
    setAppliedFilters(DEFAULT_STATEMENT_FILTERS);
    setDraftGroupBy(DEFAULT_SPEND_OVER_TIME_GROUP_BY);
    setGroupBy(DEFAULT_SPEND_OVER_TIME_GROUP_BY);
    setDraftViewType(DEFAULT_SPEND_OVER_TIME_VIEW);
    setViewType(DEFAULT_SPEND_OVER_TIME_VIEW);
  };

  return {
    workspaceFilter,
    setWorkspaceFilter,
    activeFlowType,
    setActiveFlowType,
    groupBy,
    draftGroupBy,
    setGroupBy,
    setDraftGroupBy,
    viewType,
    draftViewType,
    setViewType,
    setDraftViewType,
    groupByDropdownOpen,
    setGroupByDropdownOpen,
    viewDropdownOpen,
    setViewDropdownOpen,
    draftFilters,
    appliedFilters,
    setDraftFilters,
    typeDropdownOpen,
    statusDropdownOpen,
    dateDropdownOpen,
    fromDropdownOpen,
    filtersDrawerOpen,
    filtersDrawerScreen,
    activeFilterCount,
    setTypeDropdownOpen,
    setStatusDropdownOpen,
    setDateDropdownOpen,
    setFromDropdownOpen,
    setFiltersDrawerOpen,
    setFiltersDrawerScreen,
    updateFilter,
    applyFilterChanges,
    applyAndClose,
    resetAndClose,
    resetAllFilters,
  };
}
