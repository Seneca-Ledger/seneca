'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import toast from 'react-hot-toast';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { offerAction } from './offer-action-toast';
import type { PayeeRef } from './types';
import { fetchPendingReview } from './usePayees';

function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(params[key] ?? ''));
}

/**
 * After a category was picked for some of a payee's rows, offers it for the
 * payee's other rows still waiting in Review. Asked, never applied silently:
 * the next import follows the payee's history without being asked anyway.
 */
export function useOfferPayeeQueue() {
  const t = useIntlayer('payees');
  const queryClient = useQueryClient();
  const offerText = t.applyToOthers.value;
  const applyText = t.apply.value;
  const dismissText = t.cancel.value;
  const appliedText = t.applied.value;
  const failedText = t.failed.value;

  return useCallback(
    async (payee: PayeeRef, categoryId: string, categoryName: string, doneIds: string[]) => {
      const { transactionIds } = await fetchPendingReview(payee.id).catch(() => ({
        transactionIds: [] as string[],
      }));
      const rest = transactionIds.filter(id => !doneIds.includes(id));
      if (rest.length === 0) return;
      offerAction({
        message: fill(offerText, { count: rest.length, payee: payee.name, category: categoryName }),
        applyLabel: applyText,
        dismissLabel: dismissText,
        onApply: () => {
          void apiClient
            .post('/transactions/bulk-update', {
              items: rest.map(id => ({ id, updates: { categoryId } })),
            } satisfies ContractInput<'BulkUpdateRequestBody'>)
            .then(async () => {
              toast.success(fill(appliedText, { count: rest.length }));
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['review-inbox'] }),
                queryClient.invalidateQueries({ queryKey: ['transactions'] }),
                queryClient.invalidateQueries({ queryKey: ['payees'] }),
              ]);
            })
            .catch((error: unknown) => toast.error(getApiErrorMessage(error, failedText)));
        },
      });
    },
    [queryClient, offerText, applyText, dismissText, appliedText, failedText],
  );
}
