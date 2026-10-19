'use client';

import { useEffect, useState } from 'react';
import type { DEFAULT_FILTERS, DEFAULT_SORT, StorageFile } from '../storageHelpers';

interface FilterDeps {
  activeList: 'active' | 'trash';
  searchQuery: string;
  filters: typeof DEFAULT_FILTERS;
  sort: typeof DEFAULT_SORT;
}

export interface UseStorageTrashReturn {
  selectedTrashIds: string[];
  setSelectedTrashIds: React.Dispatch<React.SetStateAction<string[]>>;
  bulkDeleteModalOpen: boolean;
  setBulkDeleteModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  emptyTrashModalOpen: boolean;
  setEmptyTrashModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useStorageTrash(
  files: StorageFile[],
  filterDeps: FilterDeps,
): UseStorageTrashReturn {
  const [selectedTrashIds, setSelectedTrashIds] = useState<string[]>([]);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [emptyTrashModalOpen, setEmptyTrashModalOpen] = useState(false);

  const { activeList, searchQuery, filters, sort } = filterDeps;
  const isTrashView = activeList === 'trash';

  // Clear selection when filters change
  useEffect(() => {
    setSelectedTrashIds([]);
  }, [activeList, searchQuery, filters, sort]);

  // Remove selected ids that no longer exist in the file list
  useEffect(() => {
    if (!isTrashView) {
      return;
    }
    setSelectedTrashIds(prev => prev.filter(id => files.some(file => file.id === id)));
  }, [files, isTrashView]);

  return {
    selectedTrashIds,
    setSelectedTrashIds,
    bulkDeleteModalOpen,
    setBulkDeleteModalOpen,
    emptyTrashModalOpen,
    setEmptyTrashModalOpen,
  };
}
