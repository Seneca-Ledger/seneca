'use client';

import { useState } from 'react';
import { toast } from 'react-hot-toast';
import apiClient from '@/app/lib/api';
import { getQueryClient } from '@/app/lib/query-client';

type ConfirmLabels = { done: string; uncategorized: string; failed: string };

/**
 * Confirms every categorised row of the statement in one go (Review would ask
 * row by row). Rows without a category stay unconfirmed and are reported.
 */
export function useConfirmStatement(
  statementId: string,
  reload: () => Promise<void>,
  labels: ConfirmLabels,
): { confirming: boolean; confirmAll: () => Promise<void> } {
  const [confirming, setConfirming] = useState(false);

  const confirmAll = async (): Promise<void> => {
    setConfirming(true);
    try {
      const response = await apiClient.post<{ approved: number; uncategorized: number }>(
        `/review-inbox/statements/${statementId}/approve`,
      );
      const { approved, uncategorized } = response.data;
      toast.success(labels.done.replace('{count}', String(approved)));
      if (uncategorized > 0) {
        toast.error(labels.uncategorized.replace('{count}', String(uncategorized)));
      }
      const queryClient = getQueryClient();
      void queryClient.invalidateQueries({ queryKey: ['review-inbox'] });
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
      await reload();
    } catch (error) {
      console.error('Failed to confirm statement rows', error);
      toast.error(labels.failed);
    } finally {
      setConfirming(false);
    }
  };

  return { confirming, confirmAll };
}
