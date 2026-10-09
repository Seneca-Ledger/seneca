'use client';

import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/app/lib/api';

export interface BulkUpdateOwnerVariables {
  txIds: string[];
  /** `null` hands the rows back to the household as shared. */
  ownerMemberId?: string | null;
  /** Hides what the rows were from everyone but their owner. */
  isPrivate?: boolean;
}

/**
 * Moves rows to one person, or back to the household.
 *
 * Invalidating the whole `['transactions']` prefix also refreshes any other
 * mounted list, and `['reports']` because every owner-filtered report is now
 * counting different rows.
 */
export function useBulkUpdateOwner(): UseMutationResult<unknown, Error, BulkUpdateOwnerVariables> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ txIds, ownerMemberId, isPrivate }: BulkUpdateOwnerVariables) => {
      // Only the fields the caller named: an absent key means "leave it alone",
      // and sending `ownerMemberId: undefined` would read as "hand it back".
      const updates = {
        ...(ownerMemberId !== undefined ? { ownerMemberId } : {}),
        ...(isPrivate !== undefined ? { isPrivate } : {}),
      };
      return api.post('/transactions/bulk-update', {
        items: txIds.map(id => ({ id, updates })),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      await queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}
