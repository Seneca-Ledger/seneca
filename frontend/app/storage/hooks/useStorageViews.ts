'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import api from '../../lib/api';
import {
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  type SortDirection,
  type SortField,
  type StorageView,
} from '../storageHelpers';

interface UseStorageViewsMessages {
  loadViewsFailed: string;
  viewNameRequired: string;
  viewSaved: string;
  viewSaveFailed: string;
  viewDeleted: string;
  viewDeleteFailed: string;
}

export interface FilterSnapshot {
  searchQuery: string;
  filterOpen: boolean;
  filters: typeof DEFAULT_FILTERS;
  stagedFilters: typeof DEFAULT_FILTERS;
  sort: { field: SortField; direction: SortDirection };
}

export interface UseStorageViewsReturn {
  views: StorageView[];
  setViews: React.Dispatch<React.SetStateAction<StorageView[]>>;
  viewsLoading: boolean;
  viewName: string;
  setViewName: React.Dispatch<React.SetStateAction<string>>;
  viewSaving: boolean;
  loadViews: () => Promise<void>;
  applyView: (view: StorageView) => void;
  handleSaveView: (snapshot: FilterSnapshot) => Promise<void>;
  handleDeleteView: (viewId: string) => Promise<void>;
}

export function useStorageViews(
  messages: UseStorageViewsMessages,
  setActiveViewId: React.Dispatch<React.SetStateAction<string | null>>,
  setFilters: React.Dispatch<React.SetStateAction<typeof DEFAULT_FILTERS>>,
  setStagedFilters: React.Dispatch<React.SetStateAction<typeof DEFAULT_FILTERS>>,
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>,
  setSort: React.Dispatch<React.SetStateAction<{ field: SortField; direction: SortDirection }>>,
): UseStorageViewsReturn {
  const [views, setViews] = useState<StorageView[]>([]);
  const [viewsLoading, setViewsLoading] = useState(false);
  const [viewName, setViewName] = useState('');
  const [viewSaving, setViewSaving] = useState(false);

  const loadViews = async () => {
    await (async () => {
      setViewsLoading(true);
      setViews(await apiQueryDecoded({ url: '/storage/views', contract: 'StorageViewList' }));
    })()
      .catch(async error => {
        console.error('Failed to load views:', error);
        toast.error(messages.loadViewsFailed);
      })
      .finally(async () => {
        setViewsLoading(false);
      });
  };

  const applyView = (view: StorageView) => {
    const storedFilters = view.filters ?? {};
    const rawFilters = storedFilters.filters ?? {};
    const { tagIds: TagIds, ...restFilters } = rawFilters;
    const nextFilters = { ...DEFAULT_FILTERS, ...restFilters };
    setFilters(nextFilters);
    setStagedFilters(nextFilters);
    setSearchQuery(storedFilters.searchQuery ?? storedFilters.search ?? '');
    setSort({
      field: storedFilters.sort?.field ?? DEFAULT_SORT.field,
      direction: storedFilters.sort?.direction ?? DEFAULT_SORT.direction,
    });
    setActiveViewId(view.id);
  };

  const handleSaveView = async (snapshot: FilterSnapshot) => {
    const name = viewName.trim();
    if (!name) {
      toast.error(messages.viewNameRequired);
      return;
    }
    const { searchQuery, filterOpen, stagedFilters, filters, sort } = snapshot;

    await (async () => {
      setViewSaving(true);
      const response = await api.post('/storage/views', {
        name,
        filters: {
          searchQuery,
          filters: filterOpen ? stagedFilters : filters,
          sort,
        },
      } satisfies ContractInput<'StorageViewBody'>);
      setViews(prev => [response.data, ...prev]);
      setViewName('');
      setActiveViewId(response.data?.id ?? null);
      toast.success(messages.viewSaved);
    })()
      .catch(async error => {
        console.error('Failed to save view:', error);
        toast.error(messages.viewSaveFailed);
      })
      .finally(async () => {
        setViewSaving(false);
      });
  };

  const handleDeleteView = async (viewId: string) => {
    await (async () => {
      await api.delete(`/storage/views/${viewId}`);
      setViews(prev => prev.filter(view => view.id !== viewId));
      setActiveViewId(prev => (prev === viewId ? null : prev));
      toast.success(messages.viewDeleted);
    })().catch(async error => {
      console.error('Failed to delete view:', error);
      toast.error(messages.viewDeleteFailed);
    });
  };

  return {
    views,
    setViews,
    viewsLoading,
    viewName,
    setViewName,
    viewSaving,
    loadViews,
    applyView,
    handleSaveView,
    handleDeleteView,
  };
}
