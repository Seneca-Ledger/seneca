import type {
  AggregateSortKey,
  TopMerchantFlowType,
} from '@/app/(main)/statements/components/top-merchants/top-merchants.types';
import {
  type TopAnalyticsStateReturn,
  useTopAnalyticsState,
} from '@/app/(main)/statements/hooks/useTopAnalyticsState';

export type TopMerchantsStateReturn = TopAnalyticsStateReturn<
  TopMerchantFlowType,
  AggregateSortKey
>;

export const useTopMerchantsState = (): TopMerchantsStateReturn =>
  useTopAnalyticsState<TopMerchantFlowType, AggregateSortKey>(
    'seneca-top-merchants-filters',
    'spend',
    'amount',
  );
