'use client';

import { useQuery } from '@tanstack/react-query';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import type { ReturnsRange } from '../helpers/roi-url-state';

export type {
  ReturnsFlag,
  ReturnsFlagCode,
  ReturnsPoint,
  ReturnsResponse as ReturnsData,
  ReturnsSource,
} from '@/app/lib/contracts';

export function useReturns(range: ReturnsRange, enabled = true) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.investmentReturns({ workspaceId, range }),
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: '/investments/returns',
        params: { range } satisfies ContractInput<'InvestmentReturnsQuery'>,
        signal,
        contract: 'ReturnsResponse',
      }),
    enabled: enabled && Boolean(workspaceId),
    // A range switch keeps the previous figures on screen, within the same workspace only.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === workspaceId ? previous : undefined,
  });
}
