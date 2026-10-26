'use client';

import { useState } from 'react';
import { toast } from 'react-hot-toast';
import apiClient from '@/app/lib/api';
import { invalidateFinancialData } from '@/app/lib/invalidate-document-lists';
import { checkContract } from '@/app/lib/query-fn-schema';

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
      const response = await apiClient.post(`/review-inbox/statements/${statementId}/approve`);
      const { approved, uncategorized } = await checkContract(
        'StatementApproved',
        response.data,
        '/review-inbox/statements/:id/approve',
      );
      toast.success(labels.done.replace('{count}', String(approved)));
      if (uncategorized > 0) {
        toast.error(labels.uncategorized.replace('{count}', String(uncategorized)));
      }
      // Confirmed rows start counting in every figure.
      invalidateFinancialData();
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
