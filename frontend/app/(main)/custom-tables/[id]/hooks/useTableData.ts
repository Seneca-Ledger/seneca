'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import type { CustomTable } from '../utils/tableTypes';

interface Category {
  id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
}

export interface UseTableDataReturn {
  table: CustomTable | null;
  setTable: React.Dispatch<React.SetStateAction<CustomTable | null>>;
  categories: Category[];
  categoryId: string;
  setCategoryId: React.Dispatch<React.SetStateAction<string>>;
  loading: boolean;
  loadTable: () => Promise<void>;
  loadCategories: () => Promise<void>;
}

interface UseTableDataParams {
  tableId: string | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  loadTableFailedMessage: string;
}

export function useTableData({
  tableId,
  isAuthenticated,
  authLoading,
  loadTableFailedMessage,
}: UseTableDataParams): UseTableDataReturn {
  const [table, setTable] = useState<CustomTable | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string>('');
  // Loading from the start: until the first fetch begins there is no table
  // yet, and the page would otherwise flash "not found".
  const [loading, setLoading] = useState(Boolean(tableId));

  const loadCategories = useCallback(async () => {
    await (async () => {
      setCategories(await apiQueryDecoded({ url: '/categories', contract: 'CategoryList' }));
    })().catch(async error => {
      console.error('Failed to load categories:', error);
    });
  }, []);

  const loadTable = useCallback(async () => {
    if (!tableId) {
      return;
    }
    setLoading(true);

    await (async () => {
      const payload = await apiQueryDecoded({
        url: `/custom-tables/${tableId}`,
        contract: 'CustomTableDetail',
      });
      setTable(payload);
      setCategoryId(payload.categoryId ?? '');
    })()
      .catch(async error => {
        console.error('Failed to load table:', error);
        toast.error(loadTableFailedMessage);
      })
      .finally(async () => {
        setLoading(false);
      });
  }, [tableId, loadTableFailedMessage]);

  // Initial load on auth + tableId
  useEffect(() => {
    if (!authLoading && isAuthenticated && tableId) {
      loadCategories();
      loadTable();
    }
  }, [authLoading, isAuthenticated, tableId, loadCategories, loadTable]);

  return {
    table,
    setTable,
    categories,
    categoryId,
    setCategoryId,
    loading,
    loadTable,
    loadCategories,
  };
}
