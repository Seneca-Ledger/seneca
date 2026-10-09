'use client';

import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { gmailReceiptsApi } from '@/app/lib/api';
import { queryKeys } from '@/app/lib/query-keys';
import { type GmailReceipt, hasGmailReceiptAmount } from '../gmail-receipt-mapping';

const POLL_INTERVAL_MS = 6000;

export interface UseGmailReceiptsQueryParams {
  categoryId?: string | null;
  receiptStatus?: string | null;
  page: number;
  pageSize: number;
  enabled: boolean;
}

export function useGmailReceiptsQuery({
  categoryId,
  receiptStatus,
  page,
  pageSize,
  enabled,
}: UseGmailReceiptsQueryParams): UseQueryResult<GmailReceipt[], Error> {
  const workspaceId = useWorkspaceId();
  const params = {
    limit: pageSize,
    offset: Math.max(0, (page - 1) * pageSize),
    includeInvalid: false,
    // Scans without a recognised amount still belong in the list (as "Needs review").
    includeLinkedScans: true,
    ...(categoryId ? { categoryId } : {}),
    ...(receiptStatus ? { status: receiptStatus } : {}),
  };

  // When a specific status is requested (e.g. needs_review), show all matching
  // receipts regardless of whether an amount was parsed. Otherwise filter to
  // amount-present only.
  //
  // select обязан быть стабильным по ссылке: инлайн-стрелка пересчитывала бы
  // фильтр на каждый рендер и отдавала новый массив, отменяя structural sharing.
  const selectByAmount = useCallback(
    (receipts: GmailReceipt[]): GmailReceipt[] =>
      receiptStatus ? receipts : receipts.filter(hasGmailReceiptAmount),
    [receiptStatus],
  );

  return useQuery({
    queryKey: queryKeys.gmailReceipts({ workspaceId, params }),
    // Сырой список кладётся в кэш нефильтрованным, поэтому смена receiptStatus
    // меняет только select и не вызывает повторный запрос.
    queryFn: async () => {
      const response = await gmailReceiptsApi.listReceipts(params);
      return Array.isArray(response.data?.receipts) ? response.data.receipts : [];
    },
    enabled,
    refetchInterval: POLL_INTERVAL_MS,
    select: selectByAmount,
  });
}
