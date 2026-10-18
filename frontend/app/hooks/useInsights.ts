'use client';

import {
  type UseMutationResult,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback } from 'react';
import { useLocale } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import type { Insight, InsightList, InsightSeverity } from '@/app/lib/contracts';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { useWorkspaceId } from './useWorkspaceId';

export type { Insight, InsightSeverity } from '@/app/lib/contracts';

interface UseInsightsOptions {
  /** Which severities to keep. Alerts and advice are the same feed, split here. */
  severities: InsightSeverity[];
}

interface UseInsightsState {
  items: Insight[];
  isPending: boolean;
  dismiss: (id: string) => void;
  refetch: () => void;
}

/**
 * Один ключ на всех потребителей: AlertBanner (на каждом маршруте) и страница
 * советов запрашивают один и тот же GET /insights?limit=50 и различаются только
 * клиентским фильтром по severity — поэтому фильтр живёт в select, а не в ключе.
 */
export function useInsights({ severities }: UseInsightsOptions): UseInsightsState {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const key = severities.join(',');
  // Совет приходит на языке интерфейса, а не профиля: сервер перерисовывает
  // текст по ключу на каждом чтении, поэтому локаль обязана быть в ключе кэша.
  const { locale } = useLocale();

  // select обязан быть референциально стабильным: инлайн-стрелка пересчитывала бы
  // фильтр на каждый рендер и отдавала новый массив, отменяя structural sharing.
  const selectBySeverity = useCallback(
    (payload: InsightList): Insight[] => {
      const wanted = new Set(key.split(','));
      return payload.items.filter(item => wanted.has(item.severity));
    },
    [key],
  );

  const query = useQuery({
    queryKey: queryKeys.insights(workspaceId, locale),
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: '/insights',
        params: { limit: 50, locale },
        signal,
        contract: 'InsightList',
        drift: 'report',
      }),
    select: selectBySeverity,
    enabled: Boolean(workspaceId),
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/insights/${id}/dismiss`);
    },
    onMutate: async (id: string) => {
      const queryKey = queryKeys.insights(workspaceId, locale);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<InsightList>(queryKey);
      queryClient.setQueryData<InsightList>(queryKey, current =>
        current ? { ...current, items: current.items.filter(i => i.id !== id) } : current,
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.insights(workspaceId, locale), context.previous);
      }
    },
    onSettled: () => {
      // Уже убрано из вида; следующая загрузка вернёт элемент, если сервер не согласен.
      void queryClient.invalidateQueries({ queryKey: queryKeys.insightsAll(workspaceId) });
    },
  });

  const dismiss = useCallback(
    (id: string): void => {
      dismissMutation.mutate(id);
    },
    [dismissMutation.mutate],
  );

  const refetch = useCallback((): void => {
    void query.refetch();
  }, [query.refetch]);

  // Инсайты — вспомогательные. Сбой не должен ронять страницу, поэтому ошибка
  // наружу не отдаётся и лента просто остаётся пустой.
  return { items: query.data ?? [], isPending: query.isPending, dismiss, refetch };
}

/**
 * Пересчёт аналитики перед чтением. Вынесен из запроса: внутри queryFn он делал
 * бы её нечистой и потребовал бы положить флаг в ключ, разделив общий кэш.
 * Дёргается только на странице, которую пользователь открыл намеренно.
 */
/**
 * Recomputes the advice on the server. The argument is the interface
 * language, which can differ from the one saved on the profile — the advice
 * is written in whatever the reader is looking at.
 */
export function useRefreshInsights(): UseMutationResult<unknown, Error, string> {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (locale: string) => {
      // No body at all: a JSON `null` is rejected by the server's strict body parser (400).
      await apiClient.post('/insights/refresh', undefined, { params: { locale } });
    },
    // Пересчёт переписывает сами строки, а не их перевод, поэтому устаревает
    // кэш на всех языках сразу — инвалидация идёт по префиксу без локали.
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.insightsAll(workspaceId) }),
  });
}
