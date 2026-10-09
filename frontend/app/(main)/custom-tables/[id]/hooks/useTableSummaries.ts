'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';

export interface SummaryItem {
  id: string;
  title: string;
  expression: string;
  resultType: 'number' | 'text' | 'boolean' | 'date';
  value: number | string | boolean | null;
  error: string | null;
}

export interface SummaryInput {
  id?: string;
  title: string;
  expression: string;
}

interface UseTableSummariesParams {
  tableId: string | null;
  isAuthenticated: boolean;
  /** Bumped when rows change so the values stay current. */
  refreshToken: number;
  messages: { loadFailed: string; saveFailed: string };
}

/** Table-wide formulas under the grid: `SUM([income]) - SUM([expense])` and the like. */
export function useTableSummaries({
  tableId,
  isAuthenticated,
  refreshToken,
  messages,
}: UseTableSummariesParams) {
  const [items, setItems] = useState<SummaryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!(tableId && isAuthenticated)) {
      return;
    }
    setLoading(true);
    await (async () => {
      const response = await apiClient.get(`/custom-tables/${tableId}/summaries`);
      const payload = (response.data?.data ?? response.data) as { items?: SummaryItem[] };
      setItems(payload?.items ?? []);
    })()
      .catch(async error => {
        console.error('Failed to load summaries:', error);
        toast.error(getApiErrorMessage(error, messages.loadFailed));
      })
      .finally(async () => setLoading(false));
  }, [tableId, isAuthenticated, messages.loadFailed]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  const save = useCallback(
    async (next: SummaryInput[]): Promise<boolean> => {
      if (!tableId) {
        return false;
      }
      setSaving(true);
      return (async () => {
        await apiClient.patch(`/custom-tables/${tableId}/view-settings/summaries`, {
          summaries: next,
        });
        await load();
        return true;
      })()
        .catch(async error => {
          console.error('Failed to save summaries:', error);
          toast.error(getApiErrorMessage(error, messages.saveFailed));
          return false;
        })
        .finally(async () => setSaving(false));
    },
    [tableId, load, messages.saveFailed],
  );

  const upsert = useCallback(
    (input: SummaryInput) =>
      save(
        input.id && items.some(item => item.id === input.id)
          ? items.map(item => (item.id === input.id ? { ...item, ...input } : item))
          : [...items.map(({ id, title, expression }) => ({ id, title, expression })), input],
      ),
    [items, save],
  );

  const remove = useCallback(
    (id: string) =>
      save(
        items
          .filter(item => item.id !== id)
          .map(({ id: itemId, title, expression }) => ({ id: itemId, title, expression })),
      ),
    [items, save],
  );

  return { items, loading, saving, upsert, remove };
}
