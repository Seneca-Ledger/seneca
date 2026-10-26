'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useIntlayer } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import type { DashboardCashFlowEntry, DashboardData, DashboardRange } from './useDashboard.types';
import { useWorkspaceId } from './useWorkspaceId';

export type {
  DashboardActionItem,
  DashboardCashFlowEntry,
  DashboardCashFlowPoint,
  DashboardData,
  DashboardDataHealth,
  DashboardFinancialSnapshot,
  DashboardNotification,
  DashboardRange,
  DashboardRecentTransaction,
  DashboardTopCategory,
  DashboardTopMerchant,
} from './useDashboard.types';

interface DashboardState {
  data: DashboardData | undefined;
  isPending: boolean;
  isFetching: boolean;
  error: string | null;
  refetch: () => void;
  range: DashboardRange;
  changeRange: (newRange: DashboardRange) => void;
  targetDate: string | null;
  changeTargetDate: (newDate: string | null) => void;
}

/**
 * Данные предыдущего запроса переживают смену ключа только внутри одного
 * воркспейса: перезагрузка того же воркспейса (смена месяца, refresh) оставляет
 * графики на экране, а переключение воркспейса обнуляет их.
 *
 * Голый keepPreviousData здесь недопустим — он на кадр показал бы балансы
 * воркспейса A под названием воркспейса B (workspaceId — второй сегмент ключа).
 */

export function useDashboard(
  controlledRange: DashboardRange = '30d',
  controlledDate?: string,
): DashboardState {
  const workspaceId = useWorkspaceId();
  const t = useIntlayer('dashboardPage');
  const [range, setRange] = useState<DashboardRange>(controlledRange);
  const [targetDate, setTargetDate] = useState<string | null>(controlledDate ?? null);

  // Controlled props win over local state, but are adopted during render
  // rather than in an effect so a month change costs one render, not three.
  const [seenControlled, setSeenControlled] = useState({ controlledRange, controlledDate });
  if (
    seenControlled.controlledRange !== controlledRange ||
    seenControlled.controlledDate !== controlledDate
  ) {
    setSeenControlled({ controlledRange, controlledDate });
    setRange(controlledRange);
    setTargetDate(controlledDate ?? null);
  }

  const query = useQuery({
    queryKey: queryKeys.dashboard({ workspaceId, range, date: targetDate }),
    queryFn: ({ signal }) => {
      const params: Record<string, string> = { range };
      if (targetDate) params.date = targetDate;
      return apiQueryDecoded({ url: '/dashboard', params, signal, contract: 'DashboardResponse' });
    },
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === workspaceId ? previous : undefined,
    enabled: Boolean(workspaceId),
  });

  const changeRange = useCallback((newRange: DashboardRange): void => {
    setRange(newRange);
  }, []);
  const changeTargetDate = useCallback((newDate: string | null): void => {
    setTargetDate(newDate);
  }, []);
  const refetch = useCallback((): void => {
    void query.refetch();
  }, [query.refetch]);

  return {
    data: query.data,
    isPending: query.isPending,
    isFetching: query.isFetching,
    error: query.isError ? getApiErrorMessage(query.error, t.error.load.value) : null,
    refetch,
    range,
    changeRange,
    targetDate,
    changeTargetDate,
  };
}

/**
 * The named rows behind a month's daily cash flow (YYYY-MM), for the card's day tooltip.
 * `undefined` until they arrive.
 */
export function useCashFlowEntries(month: string): DashboardCashFlowEntry[] | undefined {
  const workspaceId = useWorkspaceId();
  const query = useQuery({
    queryKey: queryKeys.dashboardCashFlowEntries({ workspaceId, month }),
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        contract: 'DashboardCashFlowEntriesResponse',
        url: '/dashboard/cash-flow/entries',
        params: { month } satisfies ContractInput<'CashFlowEntriesQuery'>,
        signal,
      }),
    enabled: Boolean(workspaceId),
  });
  return query.data?.entries;
}
