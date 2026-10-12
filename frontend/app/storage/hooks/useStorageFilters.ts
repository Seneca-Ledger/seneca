'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import type { CategoryOption } from '../storageHelpers';
import {
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  type SortDirection,
  type SortField,
} from '../storageHelpers';

interface UseStorageFiltersMessages {
  loadCategoriesFailed: string;
}

export interface UseStorageFiltersReturn {
  activeList: 'active' | 'trash';
  setActiveList: React.Dispatch<React.SetStateAction<'active' | 'trash'>>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  categories: CategoryOption[];
  setCategories: React.Dispatch<React.SetStateAction<CategoryOption[]>>;
  categoriesLoading: boolean;
  filters: typeof DEFAULT_FILTERS;
  setFilters: React.Dispatch<React.SetStateAction<typeof DEFAULT_FILTERS>>;
  stagedFilters: typeof DEFAULT_FILTERS;
  setStagedFilters: React.Dispatch<React.SetStateAction<typeof DEFAULT_FILTERS>>;
  sort: { field: SortField; direction: SortDirection };
  setSort: React.Dispatch<React.SetStateAction<{ field: SortField; direction: SortDirection }>>;
  filterOpen: boolean;
  setFilterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  pageSize: number;
  activeViewId: string | null;
  setActiveViewId: React.Dispatch<React.SetStateAction<string | null>>;
  loadCategories: () => Promise<void>;
  handleSortChange: (value: string) => void;
  handleSearchChange: (value: string) => void;
  handleListChange: (next: 'active' | 'trash') => void;
}

const PAGE_SIZE = 20;

export function useStorageFilters(
  messages: UseStorageFiltersMessages,
  initialList: 'active' | 'trash' = 'active',
): UseStorageFiltersReturn {
  const [activeList, setActiveList] = useState<'active' | 'trash'>(initialList);
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [stagedFilters, setStagedFilters] = useState(DEFAULT_FILTERS);
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, filters, sort, activeList]);

  const loadCategories = async () => {
    await (async () => {
      setCategoriesLoading(true);
      setCategories(await apiQueryDecoded({ url: '/categories', contract: 'CategoryList' }));
    })()
      .catch(async error => {
        console.error('Failed to load categories:', error);
        toast.error(messages.loadCategoriesFailed);
      })
      .finally(async () => {
        setCategoriesLoading(false);
      });
  };

  const handleSortChange = (value: string) => {
    const [field, direction] = value.split(':') as [SortField, SortDirection];
    if (!(field && direction)) {
      return;
    }
    setSort({ field, direction });
    setActiveViewId(null);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setActiveViewId(null);
  };

  const handleListChange = (next: 'active' | 'trash') => {
    setActiveList(next);
    setFilterOpen(false);
  };

  return {
    activeList,
    setActiveList,
    searchQuery,
    setSearchQuery,
    categories,
    setCategories,
    categoriesLoading,
    filters,
    setFilters,
    stagedFilters,
    setStagedFilters,
    sort,
    setSort,
    filterOpen,
    setFilterOpen,
    page,
    setPage,
    pageSize: PAGE_SIZE,
    activeViewId,
    setActiveViewId,
    loadCategories,
    handleSortChange,
    handleSearchChange,
    handleListChange,
  };
}
