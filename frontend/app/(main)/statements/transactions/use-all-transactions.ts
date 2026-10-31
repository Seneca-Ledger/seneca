import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import apiClient from '@/app/lib/api';
import { resolveCurrencyCode } from '@/app/lib/format-money';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { type FilterPaymentType, monthBounds, type Period } from './all-transactions';

export const PAGE_SIZE = 50;

function periodParams(period: Period): { from?: string; to?: string } {
  return period.kind === 'month' ? monthBounds(period.month) : {};
}

/**
 * One page of every booked row in the period, newest first, with each row's
 * running wallet balance. Under the ['transactions'] prefix, so an edit
 * anywhere refreshes it.
 */
export function useAllTransactions(period: Period, page: number, paymentType?: FilterPaymentType) {
  const workspaceId = useWorkspaceId();
  const { from, to } = periodParams(period);
  const params = {
    startDate: from,
    endDate: to,
    page,
    limit: PAGE_SIZE,
    running_balance: 1,
    paymentType,
  };
  return useQuery({
    queryKey: queryKeys.transactions({ workspaceId, params: { view: 'all', ...params } }),
    queryFn: async ({ signal }) => {
      const response = await apiClient.get('/transactions', { params, signal });
      return checkContract('TransactionListPage', response.data, '/transactions');
    },
    placeholderData: keepPreviousData,
    enabled: Boolean(workspaceId),
  });
}

/** The pies and the month counts beside the table, in the workspace currency. */
export function useTransactionsOverview(period: Period) {
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const { from, to } = periodParams(period);
  const params = {
    dateFrom: from,
    dateTo: to,
    convertTo: resolveCurrencyCode(currentWorkspace?.currency),
  } satisfies ContractInput<'TransactionsOverviewQuery'>;
  return useQuery({
    queryKey: queryKeys.transactions({ workspaceId, params: { view: 'overview', ...params } }),
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: '/transactions/overview',
        params,
        signal,
        contract: 'TransactionsOverview',
      }),
    placeholderData: keepPreviousData,
    enabled: Boolean(workspaceId),
  });
}
