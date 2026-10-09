'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  type UseStatementFiltersReturn,
  useStatementFilters,
} from '@/app/(main)/statements/hooks/useStatementFilters';

export type TopAnalyticsStateReturn<TFlow extends string, TSort extends string> = {
  activeFlowType: TFlow;
  setActiveFlowType: React.Dispatch<React.SetStateAction<TFlow>>;
  sortKey: TSort;
  setSortKey: React.Dispatch<React.SetStateAction<TSort>>;
  selectedRowId: string | null;
  setSelectedRowId: React.Dispatch<React.SetStateAction<string | null>>;
  searchInput: string;
  setSearchInput: React.Dispatch<React.SetStateAction<string>>;
  workspaceFilter: string;
  setWorkspaceFilter: React.Dispatch<React.SetStateAction<string>>;
  filterState: UseStatementFiltersReturn;
};

export function useTopAnalyticsState<TFlow extends string, TSort extends string>(
  filterStorageKey: string,
  defaultFlowType: TFlow,
  defaultSortKey: TSort,
): TopAnalyticsStateReturn<TFlow, TSort> {
  const [activeFlowType, setActiveFlowType] = useState<TFlow>(defaultFlowType);
  const [sortKey, setSortKey] = useState<TSort>(defaultSortKey);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [workspaceFilter, setWorkspaceFilter] = useState<string>('current');
  // Advice links carry the month they are about (insight-href.ts); the page
  // opens on it so the totals here are the ones the advice quoted.
  const deepLinkMonth = useSearchParams()?.get('month') ?? null;
  const filterState = useStatementFilters(filterStorageKey, deepLinkMonth);
  useEffect(() => {
    setSelectedRowId(null);
  }, [activeFlowType, workspaceFilter]);
  return {
    activeFlowType,
    setActiveFlowType,
    sortKey,
    setSortKey,
    selectedRowId,
    setSelectedRowId,
    searchInput,
    setSearchInput,
    workspaceFilter,
    setWorkspaceFilter,
    filterState,
  };
}
