'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/app/hooks/useAuth';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

/** The workspace's tags with how often each is used (`GET /tags`). */
export function useTags() {
  const { user } = useAuth();
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.tags(workspaceId),
    queryFn: ({ signal }) => apiQueryDecoded({ url: '/tags', signal, contract: 'TagList' }),
    enabled: Boolean(user),
  });
}

/** Which tags each transaction carries, its own and its statement's and receipt's. */
export function useTransactionTagLinks() {
  const { user } = useAuth();
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.transactionTagLinks(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: '/tags/transaction-links',
        signal,
        contract: 'TransactionTagLinks',
      }),
    enabled: Boolean(user),
  });
}
