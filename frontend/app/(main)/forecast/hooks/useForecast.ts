'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

export type {
  ForecastDay,
  ForecastEvent,
  ForecastEventKind,
  ForecastResponse as ForecastData,
} from '@/app/lib/contracts';

export type ForecastHorizon = 30 | 90 | 365;
export const FORECAST_HORIZONS: ForecastHorizon[] = [30, 90, 365];

export interface ForecastScenario {
  incomeFactor: number;
  expenseFactor: number;
  exclude: string[];
}

const DEFAULT_SCENARIO: ForecastScenario = { incomeFactor: 1, expenseFactor: 1, exclude: [] };

export function useForecast() {
  const workspaceId = useWorkspaceId();
  const [horizon, setHorizon] = useState<ForecastHorizon>(90);
  const [scenario, setScenario] = useState<ForecastScenario>(DEFAULT_SCENARIO);

  const params = useMemo(() => {
    const query: Record<string, string | number> = { days: horizon };
    if (scenario.incomeFactor !== 1) query.incomeFactor = scenario.incomeFactor;
    if (scenario.expenseFactor !== 1) query.expenseFactor = scenario.expenseFactor;
    if (scenario.exclude.length > 0) query.exclude = scenario.exclude.join(',');
    return query;
  }, [horizon, scenario]);

  const query = useQuery({
    queryKey: queryKeys.forecast({ workspaceId, days: horizon, scenario: JSON.stringify(params) }),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/forecast', params, signal, contract: 'ForecastResponse' }),
    enabled: Boolean(workspaceId),
    // The scenario controls refetch quickly; keep the last curve on screen meanwhile.
    placeholderData: previous => previous,
  });

  const toggleExcluded = useCallback((sourceId: string) => {
    setScenario(current => ({
      ...current,
      exclude: current.exclude.includes(sourceId)
        ? current.exclude.filter(id => id !== sourceId)
        : [...current.exclude, sourceId],
    }));
  }, []);

  const setFactor = useCallback((key: 'incomeFactor' | 'expenseFactor', value: number) => {
    setScenario(current => ({ ...current, [key]: value }));
  }, []);

  return {
    data: query.data ?? null,
    isPending: query.isPending,
    isFetching: query.isFetching,
    error: query.error ? String(query.error) : null,
    horizon,
    setHorizon,
    scenario,
    toggleExcluded,
    setFactor,
  };
}
