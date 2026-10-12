'use client';

import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import type { MapStylesResponse } from './map-style';

const MAP_STYLES_STALE_TIME_MS = 10 * 60 * 1000;

export function useMapStyles(): UseQueryResult<MapStylesResponse> {
  return useQuery({
    queryKey: queryKeys.mapStyles(),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/maps/styles', signal, contract: 'MapStyles' }),
    staleTime: MAP_STYLES_STALE_TIME_MS,
  });
}
