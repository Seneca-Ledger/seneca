import {
  buildTopMerchantsLabels,
  createTx,
} from '@/app/(main)/statements/components/top-merchants/helpers/buildTopMerchantsLabels';
import {
  type TopMerchantsDataReturn,
  useTopMerchantsData,
} from '@/app/(main)/statements/components/top-merchants/hooks/useTopMerchantsData';
import {
  type TopMerchantsStateReturn,
  useTopMerchantsState,
} from '@/app/(main)/statements/components/top-merchants/hooks/useTopMerchantsState';
import {
  type TopAnalyticsViewModelReturn,
  useTopAnalyticsViewModel,
} from '@/app/(main)/statements/hooks/useTopAnalyticsViewModel';

export type TopMerchantsViewModelReturn = TopAnalyticsViewModelReturn<
  TopMerchantsStateReturn,
  TopMerchantsDataReturn
>;

export const useTopMerchantsViewModel = (month: Date): TopMerchantsViewModelReturn =>
  useTopAnalyticsViewModel(
    {
      useStateHook: useTopMerchantsState,
      useDataHook: useTopMerchantsData,
      createTx,
      buildLabels: buildTopMerchantsLabels,
    },
    month,
  );
