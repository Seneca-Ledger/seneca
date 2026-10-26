'use client';

import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { useAnalyticsPeriod } from '@/app/(main)/statements/components/analytics/flow/analytics-period';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

const isoDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** First and last day of the month, inclusive, as the server's date bounds. */
export function monthRange(month: Date): { dateFrom: string; dateTo: string } {
  const year = month.getFullYear();
  const index = month.getMonth();
  return {
    dateFrom: isoDate(new Date(year, index, 1)),
    dateTo: isoDate(new Date(year, index + 1, 0)),
  };
}

export type SpendFlowNode = {
  id: string;
  kind: 'total' | 'category' | 'subcategory' | 'merchant' | 'tag' | 'other';
  /** Null where the client supplies a localized label. */
  name: string | null;
  amount: number;
  share: number;
  color: string | null;
  mergedCount?: number;
};

export type SpendFlowData = {
  total: number;
  currency: string;
  type: 'income' | 'expense';
  dateFrom: string | null;
  nodes: SpendFlowNode[];
  links: Array<{ source: string; target: string; value: number }>;
};

/**
 * Sankey shape per page: top spenders (categories → merchants), top
 * categories (categories → subcategories), top merchants (merchants), top tags (tags).
 */
export type SpendFlowGroupBy = 'category-merchant' | 'category-subcategory' | 'merchant' | 'tag';

/** The dates the chart covers: the page's period, or else the month. */
export function useSpendFlowRange(month: Date): { dateFrom: string; dateTo: string } {
  const period = useAnalyticsPeriod();
  return period ? { dateFrom: period.from, dateTo: period.to } : monthRange(month);
}

/** The analytics sankey of the current workspace for one calendar month. */
export function useSpendFlow(
  groupBy: SpendFlowGroupBy,
  type: 'expense' | 'income',
  month: Date,
): UseQueryResult<SpendFlowData> {
  const workspaceId = useWorkspaceId();
  const range = useSpendFlowRange(month);
  const params = { groupBy, type, ...range } satisfies ContractInput<'SpendFlowQuery'>;
  return useQuery({
    queryKey: queryKeys.spendFlow({ workspaceId, params }),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/reports/spend-flow', params, signal, contract: 'SpendFlow' }),
    enabled: Boolean(workspaceId),
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2] === workspaceId ? previous : undefined,
  });
}
