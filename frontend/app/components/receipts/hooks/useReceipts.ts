'use client';

import { useCallback, useEffect, useState } from 'react';
import { type ReceiptListFilters, type ReceiptListResponse, receiptsApi } from '@/app/lib/api';

export interface ReceiptsFilterState {
  page: number;
  limit: number;
  status: string;
  source: string;
  search: string;
}

const DEFAULT_FILTERS: ReceiptsFilterState = {
  page: 1,
  limit: 20,
  status: 'all',
  source: 'all',
  search: '',
};

export function useReceipts(initialFilters?: Partial<ReceiptsFilterState>) {
  const [filters, setFilters] = useState<ReceiptsFilterState>({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  });
  const [data, setData] = useState<ReceiptListResponse>({ data: [], total: 0, page: 1, limit: 20 });
  const [isLoading, setIsLoading] = useState(true);

  const loadReceipts = useCallback(async () => {
    setIsLoading(true);

    await (async () => {
      const params: ReceiptListFilters = {
        page: filters.page,
        limit: filters.limit,
      };

      if (filters.status !== 'all') {
        params.status = filters.status;
      }

      if (filters.source !== 'all') {
        params.source = filters.source;
      }

      const response = await receiptsApi.listReceipts(params);
      setData(response);
    })().finally(async () => {
      setIsLoading(false);
    });
  }, [filters]);

  useEffect(() => {
    void loadReceipts();
  }, [loadReceipts]);

  return {
    receipts: data.data,
    total: data.total,
    page: data.page,
    limit: data.limit,
    isLoading,
    filters,
    setFilters,
    refresh: loadReceipts,
  };
}
