import type {
  AggregateSortKey,
  TopSpenderFlowType,
} from '@/app/(main)/statements/components/top-spenders/top-spenders.types';
import {
  type TopAnalyticsStateReturn,
  useTopAnalyticsState,
} from '@/app/(main)/statements/hooks/useTopAnalyticsState';

export type TopSpendersStateReturn = TopAnalyticsStateReturn<TopSpenderFlowType, AggregateSortKey>;

export const useTopSpendersState = (): TopSpendersStateReturn =>
  useTopAnalyticsState<TopSpenderFlowType, AggregateSortKey>(
    'seneca-top-spenders-filters',
    'spend',
    'amount',
  );
